const { calculateMonthly, calculateAnnual } = require('../../utils/tax-calculator');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');

const MODES = [{ key: 'monthly', title: '月度预扣' }, { key: 'annual', title: '年度汇算' }];
const MONTHS = Array.from({ length: 12 }, (_, index) => `${index + 1} 月`);

Page({
  data: {
    modes: MODES, months: MONTHS, mode: 'monthly', month: 1, salary: '', income: '', socialFund: '', special: '', other: '', prepaid: '',
    hasResult: false, result: null, resultText: '', error: ''
  },
  onShow() { const tabBar = this.getTabBar && this.getTabBar(); if (tabBar) tabBar.setData({ visible: false }); },
  onShareAppMessage() { return getShareAppMessage({ path: '/package-calc/pages/tax-calculator/tax-calculator' }); },
  onShareTimeline() { return getShareTimeline(); },
  selectMode(event) { const mode = event.currentTarget.dataset.mode; if (!MODES.some(item => item.key === mode)) return; this.setData({ mode, hasResult: false, result: null, resultText: '', error: '' }); },
  onInput(event) { const field = event.currentTarget.dataset.field; this.setData({ [field]: event.detail.value, hasResult: false, result: null, resultText: '', error: '' }); },
  changeMonth(event) { this.setData({ month: Number(event.detail.value) + 1, hasResult: false, result: null, resultText: '', error: '' }); },
  calculate() {
    try {
      const result = this.data.mode === 'monthly'
        ? calculateMonthly({ salary: this.data.salary, socialFund: this.data.socialFund, special: this.data.special, other: this.data.other, month: this.data.month })
        : calculateAnnual({ income: this.data.income, socialFund: this.data.socialFund, special: this.data.special, other: this.data.other, prepaid: this.data.prepaid });
      const money = value => `¥${Number(value).toFixed(2)}`;
      const resultText = result.mode === 'monthly'
        ? [`第 ${result.month} 月累计应纳税所得额：${money(result.cumulativeTaxable)}`, `本月预扣个税：${money(result.currentTax)}`, `本月预计到手收入：${money(result.afterTax)}`, `本月有效税率：${result.effectiveRate.toFixed(2)}%`].join('\n')
        : [`年度应纳税所得额：${money(result.taxableIncome)}`, `年度应纳个税：${money(result.annualTax)}`, `年度已预缴个税：${money(result.prepaid)}`, `${result.settlement > 0 ? '预计应补税' : result.settlement < 0 ? '预计可退税' : '预计无需补退税'}：${money(Math.abs(result.settlement))}`, `年度预计到手收入：${money(result.afterTax)}`, `税后月均：${money(result.monthlyAverage)}`].join('\n');
      this.setData({ hasResult: true, result, resultText, error: '' });
    } catch (error) { const message = error.message || '计算失败，请检查输入'; this.setData({ hasResult: false, result: null, resultText: '', error: message }); wx.showToast({ title: message, icon: 'none' }); }
  },
  copyResult() { if (!this.data.hasResult) return; wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) }); },
  clearAll() { this.setData({ salary: '', income: '', socialFund: '', special: '', other: '', prepaid: '', hasResult: false, result: null, resultText: '', error: '' }); }
});
