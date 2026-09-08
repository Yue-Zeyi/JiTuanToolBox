const runtimeConfig = require('../config/runtime');
const {
  SECURITY_MEDIA_MAX_BYTES,
  needsSecurityCopy,
  normalizeSecurityStatus
} = require('./content-security-core');

const createSecurityError = (code, message, cause) => {
  const error = new Error(message);
  error.code = code;
  error.isContentSecurityError = true;
  if (cause) error.cause = cause;
  return error;
};

const defaultWait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
// Legacy page canvases must not be reused while an earlier export is still pending.
const securityCanvasQueues = new WeakMap();

const getImageInfo = (wxApi, src) => new Promise((resolve, reject) => {
  if (!wxApi || typeof wxApi.getImageInfo !== 'function') return reject(new Error('Image information API is unavailable'));
  wxApi.getImageInfo({ src, success: resolve, fail: reject });
});

const getFileSize = (wxApi, filePath) => new Promise(resolve => {
  if (!wxApi || typeof wxApi.getFileInfo !== 'function') return resolve(0);
  wxApi.getFileInfo({ filePath, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) });
});

const getSecurityCanvas = wxApi => new Promise((resolve, reject) => {
  if (wxApi && typeof wxApi.createOffscreenCanvas === 'function') {
    try {
      const canvas = wxApi.createOffscreenCanvas({ type: '2d', width: 1, height: 1 });
      if (canvas && typeof canvas.getContext === 'function' && typeof canvas.createImage === 'function') {
        return resolve(canvas);
      }
    } catch (_) {}
  }
  if (!wxApi || typeof wxApi.createSelectorQuery !== 'function') return reject(new Error('Canvas API is unavailable'));
  wxApi.createSelectorQuery().select('#securityCanvas').fields({ node: true, size: true }).exec(result => {
    const canvas = result && result[0] && result[0].node;
    if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.createImage !== 'function') {
      return reject(new Error('Security canvas is unavailable'));
    }
    resolve(canvas);
  });
});

const withSecurityCanvas = async (canvas, operation) => {
  const previous = securityCanvasQueues.get(canvas) || Promise.resolve();
  const pending = previous.catch(() => undefined).then(operation);
  securityCanvasQueues.set(canvas, pending);
  try {
    return await pending;
  } finally {
    if (securityCanvasQueues.get(canvas) === pending) securityCanvasQueues.delete(canvas);
  }
};

const loadCanvasImage = (canvas, src) => new Promise((resolve, reject) => {
  const image = canvas.createImage();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const exportSecurityCopy = (wxApi, canvas, image, sourceWidth, sourceHeight, attempt) => {
  const scale = Math.min(1, attempt.maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    const exportImage = () => wxApi.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width,
      destHeight: height,
      fileType: 'jpg',
      quality: attempt.quality,
      success: result => result && result.tempFilePath ? resolve(result.tempFilePath) : reject(new Error('Security copy is empty')),
      fail: reject
    });
    if (typeof wxApi.nextTick === 'function') wxApi.nextTick(exportImage);
    else setTimeout(exportImage, 0);
  });
};

const getFilePath = file => {
  if (typeof file === 'string') return file;
  return file && (file.path || file.tempFilePath) || '';
};

async function prepareSecurityImage(wxApi, file) {
  if (!needsSecurityCopy(file)) return file;
  if (!wxApi || typeof wxApi.canvasToTempFilePath !== 'function') throw new Error('Canvas export API is unavailable');
  const filePath = getFilePath(file);
  const info = await getImageInfo(wxApi, filePath);
  const sourceWidth = Number(info && info.width) || 0;
  const sourceHeight = Number(info && info.height) || 0;
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('Invalid image dimensions');
  const canvas = await getSecurityCanvas(wxApi);
  return withSecurityCanvas(canvas, async () => {
    const image = await loadCanvasImage(canvas, filePath);
    const renderWidth = Number(image && image.width) || sourceWidth;
    const renderHeight = Number(image && image.height) || sourceHeight;
    const attempts = [
      { maxSide: 2000, quality: 0.82 },
      { maxSide: 1400, quality: 0.7 },
      { maxSide: 1000, quality: 0.58 }
    ];
    for (const attempt of attempts) {
      const path = await exportSecurityCopy(wxApi, canvas, image, renderWidth, renderHeight, attempt);
      const size = await getFileSize(wxApi, path);
      if (!size || size <= SECURITY_MEDIA_MAX_BYTES) {
        return { ...file, path, name: 'security-check.jpg', type: 'image/jpeg', size };
      }
    }
    throw new Error('Security copy exceeds the official size limit');
  });
}

const securityExtension = file => {
  const type = String(file && file.type || '').trim().toLowerCase().replace(/^image\//, '');
  const path = getFilePath(file);
  const match = String(file && file.name || path).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  const extension = type || (match ? match[1].toLowerCase() : 'jpg');
  if (extension === 'jpeg' || extension === 'pjpeg') return 'jpg';
  return ['jpg', 'png', 'bmp', 'gif'].includes(extension) ? extension : 'jpg';
};

function createContentSecurityClient(options = {}) {
  const wxApi = options.wxApi;
  const runtime = options.runtime || runtimeConfig;
  const wait = options.wait || defaultWait;
  const now = options.now || Date.now;
  const prepareImage = options.prepareImage || (file => prepareSecurityImage(wxApi, file));
  const timeout = Math.max(1, Number(runtime.securityTimeoutMs) || 120000);

  const timeoutError = () => createSecurityError(
    'SECURITY_CHECK_TIMEOUT',
    '内容安全检测超时，请稍后重试'
  );

  const withDeadline = (operation, deadline) => {
    const remaining = deadline - now();
    if (remaining <= 0) return Promise.reject(timeoutError());
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(timeoutError());
      }, remaining);
      Promise.resolve()
        .then(operation)
        .then(value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (now() >= deadline) reject(timeoutError());
          else resolve(value);
        }, error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        });
    });
  };

  const assertConfigured = () => {
    const cloud = wxApi && wxApi.cloud;
    if (!cloud || typeof cloud.uploadFile !== 'function' || typeof cloud.callFunction !== 'function') {
      throw createSecurityError('SECURITY_NOT_CONFIGURED', '内容安全检测尚未配置');
    }
  };

  const callFunction = data => wxApi.cloud.callFunction({
    name: runtime.securityFunctionName || 'media-security',
    data
  }).then(response => response && response.result || {});

  const deleteTemporaryFile = fileID => {
    if (!fileID || !wxApi.cloud || typeof wxApi.cloud.deleteFile !== 'function') return Promise.resolve();
    return Promise.resolve()
      .then(() => wxApi.cloud.deleteFile({ fileList: [fileID] }))
      .catch(() => undefined);
  };

  const cancelReservation = reservationId => {
    if (!reservationId) return Promise.resolve();
    return Promise.resolve()
      .then(() => callFunction({ action: 'cancel', reservationId }))
      .catch(() => undefined);
  };

  const pollResult = async (traceId, deadline, run) => {
    const interval = Math.max(0, Number(runtime.securityPollIntervalMs) || 1500);

    while (now() < deadline) {
      let result;
      try {
        result = await run(() => callFunction({ action: 'status', traceId }));
      } catch (cause) {
        if (cause && cause.isContentSecurityError) throw cause;
        throw createSecurityError('SECURITY_CHECK_FAILED', '内容安全检测失败，请稍后重试', cause);
      }
      if (now() >= deadline) throw timeoutError();
      const status = normalizeSecurityStatus(result);
      if (status === 'pass') return true;
      if (status === 'rejected') {
        throw createSecurityError('CONTENT_REJECTED', '所发布内容含违规信息');
      }
      if (status === 'error') {
        throw createSecurityError('SECURITY_CHECK_FAILED', '内容安全检测失败，请稍后重试');
      }
      await run(() => wait(Math.min(interval, Math.max(0, deadline - now()))));
    }

    throw timeoutError();
  };

  const checkOneImage = async (file, scene, batch) => {
    const deadline = now() + timeout;
    let reservationId = '';
    let fileID = '';
    let submitted = false;
    const run = operation => withDeadline(() => {
      if (batch.error) throw batch.error;
      return operation();
    }, deadline);

    try {
      const securityFile = await run(() => {
        const preparation = batch.preparationQueue.then(() => {
          if (batch.error) throw batch.error;
          if (now() >= deadline) throw timeoutError();
          return prepareImage(file);
        });
        batch.preparationQueue = preparation.catch(() => undefined);
        return preparation;
      });
      const filePath = getFilePath(securityFile);
      if (!filePath) throw createSecurityError('SECURITY_CHECK_FAILED', '未找到待检测图片');
      const reservation = await run(() => callFunction({
        action: 'reserve',
        extension: securityExtension(securityFile)
      }));
      reservationId = String(reservation && reservation.reservationId || '');
      const cloudPath = String(reservation && reservation.cloudPath || '');
      if (!reservationId || !cloudPath.startsWith('security-temp/')) {
        throw new Error('Invalid security reservation');
      }
      const uploadResult = await run(() => wxApi.cloud.uploadFile({ cloudPath, filePath }));
      fileID = uploadResult && uploadResult.fileID || '';
      if (!fileID) throw new Error('Missing uploaded file id');
      const submitResult = await run(() => callFunction({
        action: 'submit',
        reservationId,
        fileID,
        scene
      }));
      if (!submitResult.traceId) throw new Error('Missing traceId');
      submitted = true;
      const submitStatus = normalizeSecurityStatus(submitResult);
      if (submitStatus === 'pass') return true;
      if (submitStatus === 'rejected') {
        throw createSecurityError('CONTENT_REJECTED', '所发布内容含违规信息');
      }
      if (submitStatus === 'error') {
        throw createSecurityError('SECURITY_CHECK_FAILED', '内容安全检测失败，请稍后重试');
      }
      return await pollResult(submitResult.traceId, deadline, run);
    } catch (error) {
      if (reservationId && !submitted) cancelReservation(reservationId);
      if (fileID && !submitted) deleteTemporaryFile(fileID);
      if (error && error.isContentSecurityError) throw error;
      throw createSecurityError('SECURITY_CHECK_FAILED', '内容安全检测失败，请稍后重试', error);
    }
  };

  const checkSelectedImages = async (files, checkOptions = {}) => {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) return true;

    const batch = { error: null, preparationQueue: Promise.resolve() };
    let nextIndex = 0;
    let completed = 0;
    const showProgress = () => {
      if (!batch.error && wxApi && typeof wxApi.showLoading === 'function') {
        wxApi.showLoading({ title: `安全检测 ${completed}/${list.length}`, mask: true });
      }
    };
    const worker = async () => {
      while (!batch.error && nextIndex < list.length) {
        const file = list[nextIndex++];
        try {
          await checkOneImage(file, checkOptions.scene || 1, batch);
          if (batch.error) return;
          completed++;
          showProgress();
        } catch (error) {
          if (!batch.error) batch.error = error;
          throw batch.error;
        }
      }
    };
    showProgress();
    try {
      assertConfigured();
      await Promise.all(Array.from({ length: Math.min(3, list.length) }, () => worker()));
      return true;
    } finally {
      if (wxApi && typeof wxApi.hideLoading === 'function') wxApi.hideLoading();
    }
  };

  return { checkSelectedImages };
}

const checkSelectedImages = (files, options) => {
  const wxApi = typeof wx === 'undefined' ? null : wx;
  return createContentSecurityClient({ wxApi, runtime: runtimeConfig }).checkSelectedImages(files, options);
};

module.exports = { createContentSecurityClient, checkSelectedImages, prepareSecurityImage };
