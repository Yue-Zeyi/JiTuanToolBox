const { evaluateExpression, formatNumber } = require('../../utils/scientific-calculator');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const ANGLE_MODES = [
  { key: 'DEG', title: 'DEG 角度' },
  { key: 'RAD', title: 'RAD 弧度' }
];
const QUICK_TOKENS = [
  { label: '(', value: '(' }, { label: ')', value: ')' },
  { label: 'π', value: 'pi' }, { label: 'e', value: 'e' },
  { label: 'xʸ', value: '^' }, { label: '%', value: '%' },
  { label: '√', value: 'sqrt(' }, { label: 'sin', value: 'sin(' },
  { label: 'cos', value: 'cos(' }, { label: 'tan', value: 'tan(' },
  { label: 'ln', value: 'ln(' }, { label: 'log', value: 'log(' }
];

Page({
  data: {
    expression: '', angleMode: 'DEG', angleModes: ANGLE_MODES, quickTokens: QUICK_TOKENS,
    hasResult: false, resultValue: '', resultText: '', error: ''
  },
  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },
  invalidate(patch = {}) {
    this.setData({ ...patch, hasResult: false, resultValue: '', resultText: '', error: '' });
  },
  onExpressionInput(event) { this.invalidate({ expression: String(event.detail.value || '') }); },
  selectAngleMode(event) {
    const angleMode = String(event.currentTarget.dataset.mode || '').toUpperCase();
    if (ANGLE_MODES.some(item => item.key === angleMode) && angleMode !== this.data.angleMode) this.invalidate({ angleMode });
  },
  appendToken(event) {
    const token = String(event.currentTarget.dataset.token || '');
    if (token) this.invalidate({ expression: String(this.data.expression || '') + token });
  },
  backspace() {
    const expression = String(this.data.expression || '');
    this.invalidate({ expression: expression.slice(0, -1) });
  },
  clearInput() { this.invalidate({ expression: '' }); },
  calculate() {
    const expression = String(this.data.expression || '').trim();
    if (!expression) {
      const error = '请输入要计算的表达式';
      this.setData({ hasResult: false, resultValue: '', resultText: '', error });
      wx.showToast({ title: '请先输入表达式', icon: 'none' });
      return;
    }
    try {
      const resultValue = formatNumber(evaluateExpression(expression, this.data.angleMode));
      this.setData({ hasResult: true, resultValue, resultText: '计算结果：' + resultValue, error: '' });
    } catch (error) {
      const message = error && error.message ? error.message : '计算失败，请检查表达式';
      this.setData({ hasResult: false, resultValue: '', resultText: '', error: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },
  copyResult() {
    if (!this.data.hasResult || !this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/scientific-calculator/scientific-calculator' }); },
  onShareTimeline() { return getShareTimeline(); }
});
