const { calculatePercentage } = require('../../utils/percentage');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MODES = [
  { key: 'ratio', title: '求占比', first: '部分数', second: '总数', firstPlaceholder: '例如 25', secondPlaceholder: '例如 200' },
  { key: 'part', title: '求部分', first: '总数', second: '百分比 %', firstPlaceholder: '例如 200', secondPlaceholder: '例如 12.5' },
  { key: 'total', title: '求总数', first: '部分数', second: '百分比 %', firstPlaceholder: '例如 25', secondPlaceholder: '例如 12.5' },
  { key: 'change', title: '涨跌幅', first: '原值', second: '新值', firstPlaceholder: '例如 80', secondPlaceholder: '例如 100' },
  { key: 'discount', title: '折扣价', first: '原价', second: '优惠比例 %', firstPlaceholder: '例如 200', secondPlaceholder: '例如 15' }
];

Page({
  data: {
    modes: MODES, mode: 'ratio', firstLabel: MODES[0].first, secondLabel: MODES[0].second,
    firstPlaceholder: MODES[0].firstPlaceholder, secondPlaceholder: MODES[0].secondPlaceholder,
    firstValue: '', secondValue: '', hasResult: false, resultText: '', error: ''
  },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) { this.setData({ ...patch, hasResult: false, resultText: '', error: '' }); },
  onFirstInput(event) { this.invalidate({ firstValue: String(event.detail.value || '') }); },
  onSecondInput(event) { this.invalidate({ secondValue: String(event.detail.value || '') }); },
  selectMode(event) {
    const mode = String(event.currentTarget.dataset.mode || '');
    const item = MODES.find(option => option.key === mode);
    if (!item || mode === this.data.mode) return;
    this.invalidate({ mode, firstLabel: item.first, secondLabel: item.second, firstPlaceholder: item.firstPlaceholder, secondPlaceholder: item.secondPlaceholder, firstValue: '', secondValue: '' });
  },
  valuesForMode() {
    const first = this.data.firstValue;
    const second = this.data.secondValue;
    if (this.data.mode === 'ratio') return { part: first, total: second };
    if (this.data.mode === 'part') return { total: first, percentage: second };
    if (this.data.mode === 'total') return { part: first, percentage: second };
    if (this.data.mode === 'change') return { oldValue: first, newValue: second };
    return { price: first, discountPercent: second };
  },
  calculate() {
    if (!String(this.data.firstValue).trim() || !String(this.data.secondValue).trim()) {
      const error = '请完整填写两个数值';
      this.setData({ hasResult: false, resultText: '', error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const result = calculatePercentage(this.data.mode, this.valuesForMode());
      this.setData({ hasResult: true, resultText: result.text, error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '计算失败，请检查输入';
      this.setData({ hasResult: false, resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  clearAll() { this.invalidate({ firstValue: '', secondValue: '' }); },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/percentage/percentage' }); },
  onShareTimeline() { return getShareTimeline(); }
});
