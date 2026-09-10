const { calculateMortgage } = require('../../utils/mortgage');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const money = value => value.toFixed(2);
Page({
  data: {
    amount: '', years: '30', rate: '', mode: 'annuity', prepay: false, paid: '', prepayAmount: '', fee: '',
    modes: [{ key: 'annuity', title: '等额本息' }, { key: 'principal', title: '等额本金' }],
    hasResult: false, error: '', summary: [], plans: [], rows: [], tableMode: 'original', tableTotal: 0, resultText: ''
  },
  onShow() { const bar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (bar) bar.setData({ visible: false }); },
  invalidate(patch = {}) { this.calculation = null; this.setData({ hasResult: false, error: '', summary: [], plans: [], rows: [], resultText: '', tableTotal: 0, ...patch }); },
  onInput(event) {
    const key = event.currentTarget.dataset.key;
    if (['amount', 'years', 'rate', 'paid', 'prepayAmount', 'fee'].includes(key)) this.invalidate({ [key]: event.detail.value });
  },
  selectMode(event) { const mode = event.currentTarget.dataset.mode; if (['annuity', 'principal'].includes(mode)) this.invalidate({ mode }); },
  togglePrepay(event) { this.invalidate({ prepay: event.detail.value }); },
  calculate() {
    try {
      const result = calculateMortgage(this.data);
      this.calculation = result;
      const summary = [
        { label: '贷款本金', value: money(result.principal) }, { label: '累计利息', value: money(result.totalInterest) },
        { label: '首期月供', value: money(result.first) }, { label: '末期月供', value: money(result.last) },
        { label: '本息合计', value: money(result.total) }, { label: '贷款期数', value: result.months + ' 期', unit: '' }
      ];
      const pre = result.prepayment;
      const plans = pre ? pre.plans.map(plan => ({ key: plan.key, title: plan.key === 'reduce' ? '降低月供 · 期限不变' : '缩短期限 · 加快还清', months: plan.months, reducedMonths: plan.reducedMonths, saved: money(plan.saved), netSaved: money(plan.netSaved), first: money(plan.first), last: money(plan.last), interest: money(plan.interest) })) : [];
      const lines = ['房贷测算｜' + (this.data.mode === 'annuity' ? '等额本息' : '等额本金'), '年利率 ' + this.data.rate + '%（固定）', ...summary.map(item => item.label + '：' + item.value + (item.unit === '' ? '' : ' 元'))];
      if (pre) {
        lines.push('已还 ' + pre.paid + ' 期后提前还本金 ' + money(pre.amount) + ' 元，费用 ' + money(pre.fee) + ' 元');
        plans.forEach(plan => lines.push(plan.title + '：剩余 ' + plan.months + ' 期，首期月供 ' + plan.first + ' 元，节省利息 ' + plan.saved + ' 元，扣费后净省 ' + plan.netSaved + ' 元'));
      }
      lines.push('按月计息、期末提前还本金；不含利率调整，以银行合同及实际账单为准。');
      this.setData({ hasResult: true, error: '', summary, plans, balance: pre ? money(pre.balance) : '', remaining: pre ? money(pre.remaining) : '', resultText: lines.join('\n') });
      this.setTable('original');
    } catch (error) { this.invalidate({ error: error.message }); wx.showToast({ title: error.message, icon: 'none' }); }
  },
  tableRows(key) {
    if (!this.calculation) return [];
    if (key === 'original') return this.calculation.rows;
    const pre = this.calculation.prepayment;
    const plan = pre && pre.plans.find(item => item.key === key);
    return plan ? plan.rows : [];
  },
  setTable(key) { const rows = this.tableRows(key); this.setData({ tableMode: key, tableTotal: rows.length, rows: this.formatRows(rows.slice(0, 12)) }); },
  selectTable(event) { const key = event.currentTarget.dataset.key; if (['original', 'reduce', 'shorten'].includes(key)) this.setTable(key); },
  formatRows(rows) { return rows.map(row => ({ period: row.period, payment: money(row.payment), capital: money(row.capital), interest: money(row.interest), balance: money(row.balance) })); },
  loadMore() { const rows = this.tableRows(this.data.tableMode); this.setData({ rows: this.formatRows(rows.slice(0, this.data.rows.length + 12)) }); },
  copyResult() { if (this.data.hasResult) wx.setClipboardData({ data: this.data.resultText }); },
  clearAll() { this.invalidate({ amount: '', years: '30', rate: '', paid: '', prepayAmount: '', fee: '' }); },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/mortgage/mortgage' }); },
  onShareTimeline() { return getShareTimeline(); }
});
