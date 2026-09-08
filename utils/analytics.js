const runtime = require('../config/runtime');

function track(eventName, data = {}) {
  if (!runtime.analyticsEnabled || typeof wx === 'undefined' || typeof wx.reportAnalytics !== 'function') return;
  try { wx.reportAnalytics(eventName, data); } catch (error) { /* 统计失败不影响主流程 */ }
}

module.exports = { track };
