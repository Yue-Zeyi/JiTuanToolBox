const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
Page({
  data: { records: [] },
  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) { tabBar.setData({ visible: true }); tabBar.syncSelected(); }
    this.setData({ records: app.getOperationHistory() });
  },
  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/index/index' });
  },
  onShareTimeline() {
    return getShareTimeline();
  },
  copyRecordText(event) {
    const record = this.data.records[event.currentTarget.dataset.index];
    if (!record || !record.text) return;
    wx.setClipboardData({ data: record.text, success: () => wx.showToast({ title: '文字已复制' }) });
  },
  openRecord(event) {
    const record = this.data.records[event.currentTarget.dataset.index];
    if (!record || !record.page) return;
    const query = record.id ? `?recordId=${encodeURIComponent(record.id)}` : '';
    wx.navigateTo({ url: `${record.page}${query}` });
  },
  reuseRecord(event) {
    const record = this.data.records[event.currentTarget.dataset.index];
    if (record && record.page) wx.navigateTo({ url: record.page });
  },
  clearHistory() {
    wx.showModal({ title: '清空操作记录', content: '将删除本机保存的图片和文字记录，是否继续？', success: result => { if (!result.confirm) return; app.clearOperationHistory(); this.setData({ records: [] }); } });
  },
  onNav(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'history') return;
    if (target === 'home') return wx.switchTab({ url: '/pages/index/index' });
    if (target === 'profile') return wx.switchTab({ url: '/pages/profile/profile' });
  },
  goHome() { wx.navigateBack({ delta: 1 }); }
});
