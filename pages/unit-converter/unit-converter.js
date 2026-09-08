const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { CATEGORIES, convertAll } = require('../../utils/unit-converter');

Page({
  data: {
    categories: CATEGORIES.map(item => ({ key: item.key, title: item.title })),
    categoryIndex: 0,
    units: CATEGORIES[0].units,
    fromIndex: 0,
    toIndex: 1,
    inputText: '',
    result: null,
    rows: [],
    error: ''
  },

  onLoad() { this.recalculate(); },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    const category = CATEGORIES[categoryIndex];
    if (!category) return;
    this.setData({ categoryIndex, units: category.units, fromIndex: 0, toIndex: 1 }, () => this.recalculate());
  },

  onFromChange(event) {
    const fromIndex = Number(event.detail.value);
    if (this.data.units[fromIndex]) this.setData({ fromIndex }, () => this.recalculate());
  },

  onToChange(event) {
    const toIndex = Number(event.detail.value);
    if (this.data.units[toIndex]) this.setData({ toIndex }, () => this.recalculate());
  },

  onInput(event) {
    this.setData({ inputText: String(event.detail.value) }, () => this.recalculate());
  },

  swapUnits() {
    this.setData({ fromIndex: this.data.toIndex, toIndex: this.data.fromIndex }, () => this.recalculate());
  },

  recalculate() {
    if (!this.data.inputText.trim()) return this.setData({ result: null, rows: [], error: '' });
    try {
      const { categoryIndex, units, fromIndex, toIndex, inputText } = this.data;
      const rows = convertAll(inputText, CATEGORIES[categoryIndex].key, units[fromIndex].key);
      this.setData({ rows, result: rows[toIndex], error: '' });
    } catch (error) {
      this.setData({ result: null, rows: [], error: error.message || '换算失败，请检查输入' });
    }
  },

  copyResult() {
    if (this.data.result) this.copyText(this.data.result.value);
  },

  copyAll() {
    if (!this.data.rows.length) return;
    this.copyText(this.data.rows.map(row => `${row.title}：${row.approximate ? '约 ' : ''}${row.value} ${row.symbol}`).join('\n'));
  },

  copyText(data) {
    wx.setClipboardData({
      data,
      success: () => wx.showToast({ title: '换算结果已复制' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },

  clearAll() { this.setData({ inputText: '', result: null, rows: [], error: '' }); },

  onShareAppMessage() { return getShareAppMessage({ path: '/pages/unit-converter/unit-converter' }); },
  onShareTimeline() { return getShareTimeline(); }
});
