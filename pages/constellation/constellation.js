const { getConstellation } = require('../../utils/constellation');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: { month: '', day: '', hasResult: false, result: null, resultText: '', error: '' },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) { this.setData({ ...patch, hasResult: false, result: null, resultText: '', error: '' }); },
  onMonthInput(event) { this.invalidate({ month: String(event.detail.value || '') }); },
  onDayInput(event) { this.invalidate({ day: String(event.detail.value || '') }); },
  calculate() {
    if (!String(this.data.month).trim() || !String(this.data.day).trim()) {
      const error = '请输入公历月份和日期';
      this.setData({ hasResult: false, result: null, resultText: '', error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const result = getConstellation(this.data.month, this.data.day);
      const lines = [result.name, '日期区间：' + result.range, '元素：' + result.element];
      this.setData({ hasResult: true, result, resultText: lines.join(String.fromCharCode(10)), error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '查询失败，请检查日期';
      this.setData({ hasResult: false, result: null, resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  clearAll() { this.invalidate({ month: '', day: '' }); },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/constellation/constellation' }); },
  onShareTimeline() { return getShareTimeline(); }
});
