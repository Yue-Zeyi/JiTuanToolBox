const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 4096;

function imageFormat(file, outputPath) {
  const sources = [outputPath, file && file.type, file && file.name, file && file.path].filter(Boolean);
  for (let index = 0; index < sources.length; index += 1) {
    const value = String(sources[index]).toLowerCase();
    const typeMatch = value.match(/^image\/([a-z0-9]+)/);
    const extensionMatch = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/);
    const format = (typeMatch && typeMatch[1]) || (extensionMatch && extensionMatch[1]) || '';
    if (format === 'jpeg' || format === 'jpe' || format === 'jfif') return 'jpg';
    if (['jpg', 'png', 'bmp', 'webp'].includes(format)) return format;
  }
  return 'jpg';
}

function checkCancelled(isCancelled) {
  if (isCancelled && isCancelled()) throw new Error('已取消图片压缩');
}

async function fitTargetSize({ width, height, targetBytes, encode, isCancelled }) {
  if (![width, height, targetBytes].every(value => Number.isFinite(value) && value > 0)) throw new Error('图片尺寸或目标大小无效');
  let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  let outputWidth = Math.max(1, Math.round(width * scale));
  let outputHeight = Math.max(1, Math.round(height * scale));
  const attempt = async quality => {
    checkCancelled(isCancelled);
    const result = await encode(outputWidth, outputHeight, quality);
    checkCancelled(isCancelled);
    if (!result || !result.outputPath || !Number.isSafeInteger(result.compressedBytes) || result.compressedBytes <= 0) throw new Error('无法读取压缩文件的实际大小');
    return { ...result, width: outputWidth, height: outputHeight, requestedQuality: quality };
  };
  for (let resize = 0; resize < 9; resize++) {
    const high = await attempt(95);
    if (high.compressedBytes <= targetBytes) return high;
    const low = await attempt(30);
    if (low.compressedBytes <= targetBytes) {
      let best = low;
      let left = 31;
      let right = 94;
      // Actual encoder output, not a quality-to-size formula, decides every step.
      while (left <= right) {
        const quality = Math.floor((left + right) / 2);
        const candidate = await attempt(quality);
        if (candidate.compressedBytes <= targetBytes) {
          best = candidate;
          left = quality + 1;
        } else right = quality - 1;
      }
      return best;
    }
    if (outputWidth === 1 && outputHeight === 1) break;
    scale *= Math.max(0.1, Math.min(0.8, Math.sqrt(targetBytes / low.compressedBytes) * 0.9));
    outputWidth = resize === 7 ? 1 : Math.max(1, Math.floor(width * scale));
    outputHeight = resize === 7 ? 1 : Math.max(1, Math.floor(height * scale));
  }
  throw new Error('当前设备未能压到目标大小，请提高目标大小或更换图片后重试');
}

function nativeTask(run, message, onLateSuccess) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error(`${message}超时，请重试`)); }, 20000);
    const success = result => {
      if (settled) { if (onLateSuccess) onLateSuccess(result); return; }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const fail = () => { if (settled) return; settled = true; clearTimeout(timer); reject(new Error(`${message}失败，请重新选择图片`)); };
    try { run({ success, fail }); } catch (_) { fail(); }
  });
}

async function readBytes(api, path) {
  const fs = typeof api.getFileSystemManager === 'function' ? api.getFileSystemManager() : null;
  const host = fs && typeof fs.getFileInfo === 'function' ? fs : api;
  if (typeof host.getFileInfo !== 'function') throw new Error('当前微信不支持读取文件实际大小，请更新微信');
  const info = await nativeTask(callbacks => host.getFileInfo({ filePath: path, ...callbacks }), '读取文件大小');
  if (!info || !Number.isSafeInteger(info.size) || info.size <= 0) throw new Error('无法读取文件的实际大小，请重新选择图片');
  return info.size;
}

async function createEncoder(api, file, generated) {
  if (typeof api.createSelectorQuery !== 'function' || typeof api.canvasToTempFilePath !== 'function') throw new Error('当前微信不支持目标大小画布压缩，请更新微信');
  const canvas = await nativeTask(({ success, fail }) => {
    api.createSelectorQuery().select('#compressCanvas').fields({ node: true }).exec(rows => {
      if (rows && rows[0] && rows[0].node) success(rows[0].node); else fail();
    });
  }, '初始化压缩画布');
  if (typeof canvas.createImage !== 'function') throw new Error('当前微信不支持图片解码，请更新微信');
  const image = canvas.createImage();
  try {
    await nativeTask(({ success, fail }) => { image.onload = success; image.onerror = fail; image.src = file.path; }, '读取图片');
    const width = Number(image.width);
    const height = Number(image.height);
    if (!width || !height) throw new Error('无法读取图片尺寸');
    let drawnWidth = 0;
    let drawnHeight = 0;
    return {
      width, height,
      async encode(w, h, quality) {
        if (drawnWidth !== w || drawnHeight !== h) {
          canvas.width = w;
          canvas.height = h;
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, w, h);
          context.drawImage(image, 0, 0, w, h);
          drawnWidth = w;
          drawnHeight = h;
          await new Promise(resolve => typeof api.nextTick === 'function' ? api.nextTick(resolve) : setTimeout(resolve, 0));
        }
        const fileResult = await nativeTask(callbacks => api.canvasToTempFilePath({ canvas, x: 0, y: 0, width: w, height: h, destWidth: w, destHeight: h, fileType: 'jpg', quality: quality / 100, ...callbacks }), '编码图片', result => discardCompressionResults([{ path: file.path, outputPath: result && result.tempFilePath }], api));
        if (!fileResult || !fileResult.tempFilePath) throw new Error('压缩结果路径为空');
        const outputPath = fileResult.tempFilePath;
        if (outputPath !== file.path) generated.add(outputPath);
        return { outputPath, compressedBytes: await readBytes(api, outputPath) };
      },
      release() { canvas.width = 1; canvas.height = 1; image.onload = null; image.onerror = null; }
    };
  } catch (error) {
    canvas.width = 1;
    canvas.height = 1;
    image.onload = null;
    image.onerror = null;
    throw error;
  }
}

function removeGenerated(api, generated, keptPath) {
  const fs = typeof api.getFileSystemManager === 'function' ? api.getFileSystemManager() : null;
  if (!fs || typeof fs.unlink !== 'function') return;
  // Only paths returned by this run's encoder are eligible, never source files.
  generated.forEach(filePath => {
    if (filePath !== keptPath) {
      try { fs.unlink({ filePath, success() {}, fail() {} }); } catch (_) { /* Temporary files also expire with the WeChat session. */ }
    }
  });
}

function discardCompressionResults(results, api, originalPaths = []) {
  if (!api) return;
  const protectedPaths = new Set(originalPaths.concat(results.map(result => result.path)));
  const generated = new Set(results.map(result => result.outputPath).filter(path => path && !protectedPaths.has(path)));
  removeGenerated(api, generated, '');
}

async function compressFile(file, config, index, api, isCancelled) {
  if (!api) throw new Error('当前环境不支持本地压缩，请在微信中重试');
  const targetBytes = config.mode === 'target' ? Math.floor(Number(config.targetSizeKB) * 1024) : 0;
  if (config.mode === 'target' && (!Number.isSafeInteger(targetBytes) || targetBytes < 80 * 1024 || targetBytes > MAX_BYTES)) throw new Error('目标大小需在 80 KB 至 20 MB 之间');
  const originalBytes = await readBytes(api, file.path);
  if (originalBytes > MAX_BYTES) throw new Error('单张图片不能超过 20MB');
  checkCancelled(isCancelled);
  const base = { ...file, id: `${Date.now()}-${index}`, originalBytes, targetBytes };
  if (targetBytes && originalBytes <= targetBytes) return { ...base, outputPath: file.path, outputFormat: imageFormat(file, file.path), compressedBytes: originalBytes, keptOriginal: true, targetMet: true };
  const generated = new Set();
  let keptPath = '';
  let encoder;
  try {
    let result;
    if (targetBytes) {
      encoder = await createEncoder(api, file, generated);
      result = await fitTargetSize({ width: encoder.width, height: encoder.height, targetBytes, encode: encoder.encode, isCancelled });
      result = { ...result, outputFormat: 'jpg', targetMet: true, resized: result.width !== encoder.width || result.height !== encoder.height };
    } else {
      if (typeof api.compressImage !== 'function') throw new Error('当前微信不支持图片压缩，请更新微信');
      const quality = config.mode === 'auto' ? 76 : Number(config.quality);
      if (!Number.isFinite(quality) || quality < 20 || quality > 100) throw new Error('图片质量需在 20 至 100 之间');
      const output = await nativeTask(callbacks => api.compressImage({ src: file.path, quality, ...callbacks }), '图片压缩', result => discardCompressionResults([{ path: file.path, outputPath: result && result.tempFilePath }], api));
      if (!output || !output.tempFilePath) throw new Error('压缩结果路径为空');
      if (output.tempFilePath !== file.path) generated.add(output.tempFilePath);
      result = { outputPath: output.tempFilePath, outputFormat: imageFormat(file, output.tempFilePath), compressedBytes: await readBytes(api, output.tempFilePath), requestedQuality: quality };
      if (result.compressedBytes >= originalBytes) result = { outputPath: file.path, outputFormat: imageFormat(file, file.path), compressedBytes: originalBytes, keptOriginal: true };
    }
    checkCancelled(isCancelled);
    keptPath = result.outputPath;
    return { ...base, ...result };
  } finally {
    if (encoder) encoder.release();
    removeGenerated(api, generated, keptPath);
  }
}

module.exports = { fitTargetSize, compressFile, discardCompressionResults };
