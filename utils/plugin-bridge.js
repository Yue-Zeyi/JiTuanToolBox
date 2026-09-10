function decodeTarget(value) {
  let target = String(value || '').trim();
  if (/^plugin%3A/i.test(target)) {
    try { target = decodeURIComponent(target); } catch (error) { return ''; }
  }
  return target;
}

function createPluginBridgePage(pluginName) {
  const prefix = `plugin://${pluginName}/`;
  return {
    data: { failed: false },
    onLoad(options) {
      const target = decodeTarget(options && options.target);
      if (!target.startsWith(prefix)) return this.showFailure();
      wx.redirectTo({ url: target, fail: () => this.showFailure() });
    },
    showFailure() {
      this.setData({ failed: true });
      wx.showToast({ title: '服务暂时无法打开', icon: 'none' });
    },
    goBack() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      if (pages.length > 1) wx.navigateBack();
      else wx.switchTab({ url: '/pages/index/index' });
    }
  };
}

module.exports = { decodeTarget, createPluginBridgePage };
