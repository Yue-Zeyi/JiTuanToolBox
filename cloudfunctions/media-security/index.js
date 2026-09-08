const crypto = require('crypto');

const COLLECTION_NAME = 'media_security_jobs';
const PENDING_COLLECTION_NAME = 'media_security_callbacks';
const RESERVATION_EXTENSIONS = ['jpg', 'png', 'bmp', 'gif'];
const STORAGE_FILE_PREFIX = 'cloud://cloud1-d2gzwmpwtfed214d2.636c-cloud1-d2gzwmpwtfed214d2-1408318629/';

const createFunctionError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const normalizeScene = scene => {
  const value = Number(scene);
  return [1, 2, 3, 4].includes(value) ? value : 1;
};

const normalizeExtension = extension => {
  const value = String(extension || '').trim().toLowerCase().replace(/^\./, '');
  if (value === 'jpeg') return 'jpg';
  return RESERVATION_EXTENSIONS.includes(value) ? value : 'jpg';
};

const isMissingFileResult = item => /not\s*(?:exist|found)|不存在/i.test(String(item && item.errMsg || ''));

const assertDeleteSucceeded = (result, fileID) => {
  const item = result && Array.isArray(result.fileList) ? result.fileList[0] : null;
  if (!item || (Number(item.status) !== 0 && !isMissingFileResult(item))) {
    throw new Error(`Unable to delete temporary media: ${fileID}`);
  }
};

const readDocument = async (collection, id) => {
  if (!collection || !id) return null;
  try {
    const result = await collection.doc(id).get();
    return result && result.data || null;
  } catch (_) {
    return null;
  }
};

function createMediaSecurityHandler(dependencies) {
  const {
    getOpenId,
    getAppId,
    createReservationId,
    getReservedFileID,
    getTempFileURL,
    submitMediaCheck,
    deleteFile,
    claimReservation,
    collection,
    pendingCollection,
    now = () => new Date()
  } = dependencies;

  const cleanFile = async (documentId, fileID, timestamp) => {
    const result = await deleteFile(fileID);
    assertDeleteSucceeded(result, fileID);
    await collection.doc(documentId).update({ data: { cleanedAt: timestamp, updatedAt: timestamp } });
  };

  const reserve = async event => {
    const openid = getOpenId();
    if (!openid) throw createFunctionError('INVALID_USER', 'Unable to identify the current user');
    const reservationId = String(createReservationId() || '');
    if (!/^[a-z0-9_-]{8,128}$/i.test(reservationId)) {
      throw createFunctionError('RESERVATION_FAILED', 'Unable to create a security reservation');
    }
    const cloudPath = `security-temp/${reservationId}.${normalizeExtension(event.extension)}`;
    const fileID = String(getReservedFileID(cloudPath) || '');
    if (!fileID || !fileID.endsWith(`/${cloudPath}`)) {
      throw new Error('Invalid reserved file id');
    }
    const timestamp = now();
    await collection.doc(reservationId).set({
      data: {
        kind: 'reservation',
        openid,
        cloudPath,
        fileID,
        status: 'reserved',
        suggest: '',
        cleanedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });
    return { reservationId, cloudPath };
  };

  const markReservationFailed = async reservation => {
    const timestamp = now();
    try {
      await collection.doc(reservation._id).update({
        data: { status: 'error', suggest: '', updatedAt: timestamp }
      });
    } catch (_) {}
    try {
      await cleanFile(reservation._id, reservation.fileID, timestamp);
    } catch (_) {}
  };

  const applyPendingCallback = async (traceId, job) => {
    const pending = await readDocument(pendingCollection, traceId);
    if (!pending) return 'checking';
    const result = !pending.appid || pending.appid !== job.appid
      ? { status: 'error', suggest: '' }
      : {
        status: ['pass', 'rejected', 'error'].includes(pending.status) ? pending.status : 'error',
        suggest: pending.status === 'pass' || pending.status === 'rejected' ? String(pending.suggest || '') : ''
      };
    const timestamp = now();
    await collection.doc(traceId).update({ data: { ...result, updatedAt: timestamp } });
    try { await cleanFile(traceId, job.fileID, timestamp); } catch (_) {}
    try { await pendingCollection.doc(traceId).remove(); } catch (_) {}
    return result.status;
  };

  const submit = async event => {
    const openid = getOpenId();
    const reservationId = String(event.reservationId || '');
    const fileID = String(event.fileID || '');
    if (!openid) throw createFunctionError('INVALID_USER', 'Unable to identify the current user');
    const claim = await claimReservation({
      reservationId,
      openid,
      fileID,
      nextStatus: 'submitting',
      timestamp: now()
    });
    if (!claim) {
      throw createFunctionError('INVALID_RESERVATION', 'Invalid security reservation');
    }
    if (claim.reason === 'file') {
      throw createFunctionError('INVALID_FILE', 'Invalid temporary image');
    }
    if (claim.reason === 'reservation' || !claim.reservation) {
      throw createFunctionError('INVALID_RESERVATION', 'Invalid security reservation');
    }
    if (!fileID || !String(claim.reservation.cloudPath || '').startsWith('security-temp/')) {
      throw createFunctionError('INVALID_FILE', 'Invalid temporary image');
    }
    const reservation = claim.reservation;

    let traceId = '';
    let job;
    try {
      const mediaUrl = await getTempFileURL(fileID);
      if (!mediaUrl) throw new Error('Unable to create a temporary media URL');
      const apiResult = await submitMediaCheck({
        mediaUrl,
        mediaType: 2,
        version: 2,
        scene: normalizeScene(event.scene),
        openid
      });
      const errCode = apiResult && (apiResult.errCode !== undefined ? apiResult.errCode : apiResult.errcode);
      if (errCode !== undefined && Number(errCode) !== 0) throw new Error('The security API rejected the request');
      traceId = String(apiResult && (apiResult.traceId || apiResult.trace_id) || '');
      if (!traceId) throw new Error('The security API did not return a trace id');
      const timestamp = now();
      job = {
        kind: 'job',
        openid,
        appid: getAppId(),
        cloudPath: reservation.cloudPath,
        fileID,
        status: 'checking',
        suggest: '',
        cleanedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await collection.doc(traceId).set({ data: job });
    } catch (error) {
      await markReservationFailed(reservation);
      throw error;
    }

    try { await collection.doc(reservationId).remove(); } catch (_) {}
    const status = await applyPendingCallback(traceId, job);
    return { traceId, status };
  };

  const cancel = async event => {
    const openid = getOpenId();
    const reservationId = String(event.reservationId || '');
    if (!openid || !reservationId) return { cancelled: false };
    const existing = await readDocument(collection, reservationId);
    if (!existing) return { cancelled: false };
    if (existing.openid !== openid) {
      throw createFunctionError('INVALID_RESERVATION', 'Invalid security reservation');
    }
    const claim = await claimReservation({
      reservationId,
      openid,
      nextStatus: 'cancelling',
      timestamp: now()
    });
    if (!claim || !claim.reservation) return { cancelled: false };
    const reservation = claim.reservation;
    try {
      const result = await deleteFile(reservation.fileID);
      assertDeleteSucceeded(result, reservation.fileID);
      await collection.doc(reservationId).remove();
      return { cancelled: true };
    } catch (error) {
      try {
        await collection.doc(reservationId).update({ data: { status: 'error', updatedAt: now() } });
      } catch (_) {}
      throw error;
    }
  };

  const getStatus = async event => {
    const openid = getOpenId();
    const traceId = String(event.traceId || '');
    if (!openid || !traceId) throw createFunctionError('JOB_NOT_FOUND', 'Security job not found');
    const job = await readDocument(collection, traceId);
    if (!job || job.openid !== openid || job.kind === 'reservation') {
      throw createFunctionError('JOB_NOT_FOUND', 'Security job not found');
    }
    return { status: job.status || 'error', suggest: job.suggest || '' };
  };

  return async event => {
    if (event && event.action === 'reserve') return reserve(event);
    if (event && event.action === 'submit') return submit(event);
    if (event && event.action === 'cancel') return cancel(event);
    if (event && event.action === 'status') return getStatus(event);
    throw createFunctionError('INVALID_ACTION', 'Unsupported action');
  };
}

let defaultHandler;

const serializeHandlerError = error => ({
  errcode: -1,
  code: error && error.code || 'MEDIA_SECURITY_ERROR',
  message: error && error.message || 'Media security check failed'
});

const createMediaSecurityMain = (handler, logError = console.error) => async (event, context) => {
  try {
    return await handler(event, context);
  } catch (error) {
    logError('[media-security]', serializeHandlerError(error));
    return serializeHandlerError(error);
  }
};

function getDefaultHandler() {
  if (defaultHandler) return defaultHandler;
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const database = cloud.database();
  const collection = database.collection(COLLECTION_NAME);
  const pendingCollection = database.collection(PENDING_COLLECTION_NAME);
  const claimReservation = async ({ reservationId, openid, fileID, nextStatus, timestamp }) => {
    const transaction = await database.startTransaction();
    let finished = false;
    try {
      const result = await transaction.collection(COLLECTION_NAME).doc(reservationId).get();
      const reservation = result && result.data;
      if (!reservation || reservation.openid !== openid || reservation.status !== 'reserved') {
        await transaction.rollback();
        finished = true;
        return { reason: 'reservation' };
      }
      if (fileID !== undefined && fileID !== reservation.fileID) {
        await transaction.rollback();
        finished = true;
        return { reason: 'file' };
      }
      await transaction.collection(COLLECTION_NAME).doc(reservationId).update({
        data: { status: nextStatus, updatedAt: timestamp }
      });
      await transaction.commit();
      finished = true;
      return { reservation };
    } catch (_) {
      if (!finished) {
        try { await transaction.rollback(); } catch (_) {}
      }
      return { reason: 'reservation' };
    }
  };
  defaultHandler = createMediaSecurityHandler({
    getOpenId: () => cloud.getWXContext().OPENID,
    getAppId: () => cloud.getWXContext().APPID,
    createReservationId: () => crypto.randomBytes(18).toString('hex'),
    getReservedFileID: cloudPath => `${STORAGE_FILE_PREFIX}${cloudPath}`,
    getTempFileURL: async fileID => {
      const result = await cloud.getTempFileURL({ fileList: [fileID] });
      const file = result && result.fileList && result.fileList[0];
      return file && Number(file.status) === 0 && file.tempFileURL || '';
    },
    submitMediaCheck: options => cloud.openapi.security.mediaCheckAsync(options),
    deleteFile: fileID => cloud.deleteFile({ fileList: [fileID] }),
    claimReservation,
    collection,
    pendingCollection
  });
  return defaultHandler;
}

exports.main = createMediaSecurityMain((event, context) => getDefaultHandler()(event, context));
exports.createMediaSecurityHandler = createMediaSecurityHandler;
exports.createMediaSecurityMain = createMediaSecurityMain;
exports.assertDeleteSucceeded = assertDeleteSucceeded;
