const crypto = require('crypto');

const COLLECTION_NAME = 'media_security_jobs';
const PENDING_COLLECTION_NAME = 'media_security_callbacks';
const EXPIRE_AFTER_MS = 35 * 60 * 1000;
const ACTIVE_STATUSES = ['checking', 'reserved', 'submitting', 'cancelling'];

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
  body: String(body)
});

const validSignature = (token, query = {}) => {
  if (!token || !query.signature || !query.timestamp || !query.nonce) return false;
  const expected = crypto
    .createHash('sha1')
    .update([token, String(query.timestamp), String(query.nonce)].sort().join(''))
    .digest('hex');
  const actual = String(query.signature);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

const parseBody = event => {
  const raw = event && event.body || '';
  const text = event && event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
  return typeof text === 'string' ? JSON.parse(text) : text;
};

const normalizeCallbackResult = payload => {
  const validEnvelope = payload
    && payload.MsgType === 'event'
    && payload.Event === 'wxa_media_check'
    && payload.FromUserName
    && Number(payload.version) === 2
    && payload.errcode !== undefined
    && Number(payload.errcode) === 0;
  if (!validEnvelope) return { status: 'error', suggest: '' };
  const suggest = payload.result && payload.result.suggest;
  if (suggest === 'pass') return { status: 'pass', suggest };
  if (suggest === 'risky' || suggest === 'review') return { status: 'rejected', suggest };
  return { status: 'error', suggest: '' };
};

const isMissingFileResult = item => /not\s*(?:exist|found)|不存在/i.test(String(item && item.errMsg || ''));

const assertDeleteSucceeded = (result, fileID) => {
  const item = result && Array.isArray(result.fileList) ? result.fileList[0] : null;
  if (!item || (Number(item.status) !== 0 && !isMissingFileResult(item))) {
    throw new Error(`Unable to delete temporary media: ${fileID}`);
  }
};

function createCallbackHandler(dependencies) {
  const {
    token,
    appid,
    getJob,
    updateJob,
    savePendingCallback,
    removePendingCallback,
    deleteFile,
    findExpiredJobs,
    findExpiredPendingCallbacks,
    now = () => new Date()
  } = dependencies;

  const cleanFile = async (job, timestamp) => {
    if (!job || !job.fileID) return false;
    const result = await deleteFile(job.fileID);
    assertDeleteSucceeded(result, job.fileID);
    await updateJob(job._id, { cleanedAt: timestamp, updatedAt: timestamp });
    return true;
  };

  const applyResult = async (job, result, timestamp) => {
    await updateJob(job._id, { ...result, updatedAt: timestamp });
    try { await cleanFile(job, timestamp); } catch (_) {}
  };

  const cleanupExpired = async () => {
    const timestamp = now();
    const cutoff = new Date(timestamp.getTime() - EXPIRE_AFTER_MS);
    const jobs = await findExpiredJobs(cutoff);
    let cleaned = 0;
    for (const job of jobs) {
      if (ACTIVE_STATUSES.includes(job.status)) {
        try {
          await updateJob(job._id, { status: 'error', suggest: '', updatedAt: timestamp });
        } catch (_) { continue; }
      }
      try {
        if (await cleanFile(job, timestamp)) cleaned += 1;
      } catch (_) {}
    }

    const pendingCallbacks = await findExpiredPendingCallbacks(cutoff);
    let pendingRemoved = 0;
    for (const pending of pendingCallbacks) {
      try {
        await removePendingCallback(pending._id);
        pendingRemoved += 1;
      } catch (_) {}
    }
    return { cleaned, pendingRemoved };
  };

  const handleHttp = async event => {
    const method = String(event.httpMethod || '').toUpperCase();
    const query = event.queryStringParameters || event.queryString || {};
    if (!validSignature(token, query)) return response(401, 'invalid signature');
    if (method === 'GET') return response(200, query.echostr || '');
    if (method !== 'POST') return response(405, 'method not allowed');

    let payload;
    try {
      payload = parseBody(event);
    } catch (_) {
      return response(400, 'invalid request');
    }
    if (!appid || !payload || payload.appid !== appid) return response(403, 'app mismatch');
    const traceId = String(payload && (payload.trace_id || payload.traceId) || '');
    if (!traceId) return response(400, 'invalid request');
    const result = normalizeCallbackResult(payload);
    const timestamp = now();
    let job = await getJob(traceId);

    if (!job) {
      await savePendingCallback(traceId, {
        appid,
        ...result,
        receivedAt: timestamp
      });
      job = await getJob(traceId);
      if (!job) return response(200, 'success');
    }

    if (job.appid && job.appid !== appid) {
      try { await removePendingCallback(traceId); } catch (_) {}
      return response(403, 'app mismatch');
    }

    await applyResult(job, result, timestamp);
    try { await removePendingCallback(traceId); } catch (_) {}
    return response(200, 'success');
  };

  return event => {
    if (event && (event.action === 'cleanup' || event.Type === 'Timer')) return cleanupExpired();
    return handleHttp(event || {});
  };
}

let defaultHandler;

function getDefaultHandler() {
  if (defaultHandler) return defaultHandler;
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const database = cloud.database();
  const command = database.command;
  const collection = database.collection(COLLECTION_NAME);
  const pendingCollection = database.collection(PENDING_COLLECTION_NAME);
  const getJob = async traceId => {
    try {
      const result = await collection.doc(traceId).get();
      return result && result.data || null;
    } catch (_) {
      return null;
    }
  };
  defaultHandler = createCallbackHandler({
    token: process.env.WECHAT_CALLBACK_TOKEN || '',
    appid: 'wxc4716148be4731f9',
    getJob,
    updateJob: (traceId, data) => collection.doc(traceId).update({ data }),
    savePendingCallback: (traceId, data) => pendingCollection.doc(traceId).set({ data }),
    removePendingCallback: traceId => pendingCollection.doc(traceId).remove(),
    deleteFile: fileID => cloud.deleteFile({ fileList: [fileID] }),
    findExpiredJobs: async cutoff => {
      const result = await collection.where({
        createdAt: command.lt(cutoff),
        cleanedAt: command.eq(null)
      }).limit(100).get();
      return result && result.data || [];
    },
    findExpiredPendingCallbacks: async cutoff => {
      const result = await pendingCollection.where({
        receivedAt: command.lt(cutoff)
      }).limit(100).get();
      return result && result.data || [];
    }
  });
  return defaultHandler;
}

exports.main = (event, context) => getDefaultHandler()(event, context);
exports.createCallbackHandler = createCallbackHandler;
exports.validSignature = validSignature;
exports.normalizeCallbackResult = normalizeCallbackResult;
exports.assertDeleteSucceeded = assertDeleteSucceeded;
