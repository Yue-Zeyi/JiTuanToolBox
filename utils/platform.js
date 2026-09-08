function isDevtools() {
  if (typeof wx === 'undefined' || typeof wx.getSystemInfoSync !== 'function') return false;
  try { return wx.getSystemInfoSync().platform === 'devtools'; } catch (error) { return false; }
}

module.exports = { isDevtools };
