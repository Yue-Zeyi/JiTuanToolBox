const { calculateAge } = require('../../utils/age-query');
const { localToday } = require('../../utils/local-date');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: { birthDate: '', todayDate: '', hasResult: false, result: null, resultText: '', error: '' },
  onLoad() { this.setData({ todayDate: localToday() }); },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) { this.setData({ ...patch, hasResult: false, result: null, resultText: '', error: '' }); },
  onBirthDateChange(event) { this.invalidate({ birthDate: String(event.detail.value || '') }); },
  calculate() {
    if (!this.data.birthDate) {
      const error = '请选择出生日期';
      this.setData({ hasResult: false, result: null, resultText: '', error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const todayDate = this.data.todayDate || localToday();
      const result = calculateAge(this.data.birthDate, todayDate);
      const lines = [
        '周岁：' + result.age + ' 岁',
        '已生活：' + result.livedDays + ' 天',
        '距离下次生日：' + result.daysToBirthday + ' 天',
        '下次生日：' + result.nextBirthday
      ];
      if (result.leapBirthdayAdjusted) lines.push('2月29日生日在该非闰年按2月28日计算。');
      this.setData({ hasResult: true, result, resultText: lines.join(String.fromCharCode(10)), error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '查询失败，请检查生日';
      this.setData({ hasResult: false, result: null, resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  clearAll() { this.invalidate({ birthDate: '' }); },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/age-query/age-query' }); },
  onShareTimeline() { return getShareTimeline(); }
});
