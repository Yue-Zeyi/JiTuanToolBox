const { getDateInfo } = require('../../utils/date-info');
const { localToday } = require('../../utils/local-date');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

function relativeText(days) {
  if (days === 0) return '今天';
  return days > 0 ? '未来 ' + days + ' 天' : '过去 ' + Math.abs(days) + ' 天';
}

Page({
  data: { dateValue: '', todayDate: '', hasResult: false, result: null, relativeLabel: '', resultText: '', error: '' },
  onLoad() { this.setData({ todayDate: localToday() }); },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) { this.setData({ ...patch, hasResult: false, result: null, relativeLabel: '', resultText: '', error: '' }); },
  onDateChange(event) { this.invalidate({ dateValue: String(event.detail.value || '') }); },
  calculate() {
    if (!this.data.dateValue) {
      const error = '请选择要查询的日期';
      this.setData({ hasResult: false, result: null, relativeLabel: '', resultText: '', error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const todayDate = this.data.todayDate || localToday();
      const result = getDateInfo(this.data.dateValue, todayDate);
      const relativeLabel = relativeText(result.daysFromToday);
      const lines = [
        this.data.dateValue + ' · ' + result.weekday,
        '年内第 ' + result.dayOfYear + ' 天',
        'ISO 周：' + result.isoWeekYear + '-W' + String(result.isoWeek).padStart(2, '0'),
        '第 ' + result.quarter + ' 季度',
        result.leapYear ? '闰年' : '平年',
        '距今天：' + relativeLabel
      ];
      this.setData({ hasResult: true, result, relativeLabel, resultText: lines.join(String.fromCharCode(10)), error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '查询失败，请检查日期';
      this.setData({ hasResult: false, result: null, relativeLabel: '', resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  clearAll() { this.invalidate({ dateValue: '' }); },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/date-info/date-info' }); },
  onShareTimeline() { return getShareTimeline(); }
});
