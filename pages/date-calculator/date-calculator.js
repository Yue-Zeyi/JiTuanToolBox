const { dateDifference, addCalendarDays, businessDayDifference } = require('../../utils/date-calculator');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MODES = [
  { key: 'difference', title: '日期差' },
  { key: 'add', title: '日期加减' },
  { key: 'business', title: '工作日差' }
];

Page({
  data: { modes: MODES, mode: 'difference', startDate: '', endDate: '', dayAmount: '', hasResult: false, resultText: '', error: '' },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) { this.setData({ ...patch, hasResult: false, resultText: '', error: '' }); },
  selectMode(event) {
    const mode = String(event.currentTarget.dataset.mode || '');
    if (MODES.some(item => item.key === mode) && mode !== this.data.mode) this.invalidate({ mode });
  },
  onStartDateChange(event) { this.invalidate({ startDate: String(event.detail.value || '') }); },
  onEndDateChange(event) { this.invalidate({ endDate: String(event.detail.value || '') }); },
  onDayAmountInput(event) { this.invalidate({ dayAmount: String(event.detail.value || '') }); },
  calculate() {
    try {
      let lines;
      if (this.data.mode === 'add') {
        if (!this.data.startDate || !String(this.data.dayAmount).trim()) throw new Error('请选择日期并填写加减天数');
        const amount = Number(this.data.dayAmount);
        if (!Number.isInteger(amount)) throw new Error('加减天数必须是整数');
        const resultDate = addCalendarDays(this.data.startDate, amount);
        lines = ['计算结果：' + resultDate, this.data.startDate + (amount >= 0 ? ' + ' : ' − ') + Math.abs(amount) + ' 天'];
      } else {
        if (!this.data.startDate || !this.data.endDate) throw new Error('请选择开始日期和结束日期');
        if (this.data.mode === 'business') {
          const days = businessDayDifference(this.data.startDate, this.data.endDate);
          lines = ['工作日相差：' + days + ' 天', '仅计算周一至周五，不包含法定节假日与调休。'];
        } else {
          const days = dateDifference(this.data.startDate, this.data.endDate);
          lines = ['日期相差：' + days + ' 天', '绝对天数：' + Math.abs(days) + ' 天'];
        }
      }
      this.setData({ hasResult: true, resultText: lines.join(String.fromCharCode(10)), error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '计算失败，请检查日期';
      this.setData({ hasResult: false, resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  clearAll() { this.invalidate({ startDate: '', endDate: '', dayAmount: '' }); },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/date-calculator/date-calculator' }); },
  onShareTimeline() { return getShareTimeline(); }
});
