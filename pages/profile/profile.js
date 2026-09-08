const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: { version: '1.0.0' },
  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) { tabBar.setData({ visible: true }); tabBar.syncSelected(); }
  },
  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/index/index' });
  },
  onShareTimeline() {
    return getShareTimeline();
  },
  openLegal(event) {
    const type = event.currentTarget.dataset.type || 'privacy';
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` });
  },
  showFeedback() {
    const email = 'itzeyi@qq.com';
    const showEmailTip = () => wx.showModal({
      title: '邮件反馈',
      content: `反馈邮箱：${email}\n邮箱地址已复制，请在邮箱客户端中粘贴收件人并发送。`,
      showCancel: false
    });
    if (typeof wx.setClipboardData !== 'function') return showEmailTip();
    wx.setClipboardData({ data: email, success: showEmailTip, fail: showEmailTip });
  },
  onNav(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'profile') return;
    if (target === 'home') return wx.switchTab({ url: '/pages/index/index' });
    if (target === 'history') return wx.switchTab({ url: '/pages/history/history' });
  }
});
