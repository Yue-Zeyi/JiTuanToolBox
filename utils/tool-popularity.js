const runtime = require('../config/runtime');

const FUNCTION_NAME = runtime.popularityFunctionName || 'tool-popularity';

function callCloud(data) {
  if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return Promise.reject(new Error('Cloud service is unavailable'));
  }
  return wx.cloud.callFunction({ name: FUNCTION_NAME, data }).then(response => response && response.result);
}

function reportToolClick(toolKey) {
  const key = String(toolKey || '');
  if (!key) return Promise.resolve(false);
  return callCloud({ action: 'increment', toolKey: key })
    .then(result => Boolean(result && result.ok))
    .catch(() => false);
}

function fetchPopularToolKeys(limit = 6) {
  const safeLimit = Math.max(1, Math.min(6, Math.floor(Number(limit)) || 6));
  return callCloud({ action: 'top', limit: safeLimit })
    .then(result => {
      if (!result || !result.ok || !Array.isArray(result.items)) return [];
      return result.items.map(item => String(item && item.key || '')).filter(Boolean).slice(0, safeLimit);
    })
    .catch(() => []);
}

module.exports = { reportToolClick, fetchPopularToolKeys };
