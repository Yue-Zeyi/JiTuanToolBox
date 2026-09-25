const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'expense-split', title: 'AA 分账', desc: '多人垫付，自动算清谁补给谁', icon: 'expense-split', tone: 'green', page: '/pages/expense-split/expense-split' };

function parsePeople(text) {
  return Array.from(new Set(String(text || '').split(/[\n,，、]+/).map(item => item.trim()).filter(Boolean)));
}

function parseExpenses(text, people) {
  return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(/[|｜]/).map(item => item.trim());
    if (parts.length < 4) throw new Error(`第 ${index + 1} 笔格式不完整，请按“项目｜金额｜付款人｜参与人”填写`);
    const amount = Number(parts[1].replace(/[,，￥¥\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`第 ${index + 1} 笔金额无效`);
    const payer = parts[2];
    const attendees = Array.from(new Set(parts[3].split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean)));
    if (!people.includes(payer)) throw new Error(`第 ${index + 1} 笔付款人“${payer}”不在参与人列表`);
    if (!attendees.length || attendees.some(item => !people.includes(item))) throw new Error(`第 ${index + 1} 笔参与人需来自参与人列表`);
    return { title: parts[0] || `第 ${index + 1} 笔支出`, amount, amountCents: Math.round(amount * 100), payer, attendees };
  });
}

function settleBalances(balances) {
  const debtors = Object.keys(balances).filter(name => balances[name] < 0).map(name => ({ name, amount: -balances[name] })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.keys(balances).filter(name => balances[name] > 0).map(name => ({ name, amount: balances[name] })).sort((a, b) => b.amount - a.amount);
  const result = [];
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    result.push({ from: debtors[i].name, to: creditors[j].name, amount, amountText: (amount / 100).toFixed(2) });
    debtors[i].amount -= amount; creditors[j].amount -= amount;
    if (debtors[i].amount < 0.005) i += 1;
    if (creditors[j].amount < 0.005) j += 1;
  }
  return result;
}

Page({
  data: { peopleText: '', expenseText: '', hasResult: false, totalText: '0.00', balances: [], settlements: [], error: '' },
  onShow() { const tabBar = this.getTabBar && this.getTabBar(); if (tabBar) tabBar.setData({ visible: false }); },
  onPeopleInput(event) { this.setData({ peopleText: String(event.detail.value || ''), hasResult: false, error: '' }); },
  onExpenseInput(event) { this.setData({ expenseText: String(event.detail.value || ''), hasResult: false, error: '' }); },
  calculate() {
    try {
      const people = parsePeople(this.data.peopleText);
      if (people.length < 2) throw new Error('请至少填写两位参与人');
      const expenses = parseExpenses(this.data.expenseText, people);
      if (!expenses.length) throw new Error('请至少填写一笔支出');
      const balances = Object.fromEntries(people.map(name => [name, 0]));
      let totalCents = 0;
      expenses.forEach(expense => {
        totalCents += expense.amountCents;
        balances[expense.payer] += expense.amountCents;
        const baseShare = Math.floor(expense.amountCents / expense.attendees.length);
        let remainder = expense.amountCents - (baseShare * expense.attendees.length);
        expense.attendees.forEach(name => {
          balances[name] -= baseShare + (remainder > 0 ? 1 : 0);
          remainder -= remainder > 0 ? 1 : 0;
        });
      });
      const balanceRows = people.map(name => ({ name, amount: balances[name], label: balances[name] > 0 ? `应收 ¥${(balances[name] / 100).toFixed(2)}` : balances[name] < 0 ? `应付 ¥${(Math.abs(balances[name]) / 100).toFixed(2)}` : '已结清' }));
      this.setData({ hasResult: true, totalText: (totalCents / 100).toFixed(2), balances: balanceRows, settlements: settleBalances(balances), error: '' });
    } catch (error) { this.setData({ hasResult: false, error: error.message || '分账失败，请检查输入' }); wx.showToast({ title: error.message || '分账失败', icon: 'none' }); }
  },
  copyResult() {
    if (!this.data.hasResult) return;
    const lines = [`AA 分账｜总支出 ¥${this.data.totalText}`, ...this.data.balances.map(item => `${item.name}：${item.label}`), '建议转账：', ...(this.data.settlements.length ? this.data.settlements.map(item => `${item.from} → ${item.to} ¥${item.amountText}`) : ['无需转账'])];
    wx.setClipboardData({ data: lines.join('\n'), success: () => wx.showToast({ title: '分账结果已复制' }) });
  },
  clearAll() { this.setData({ peopleText: '', expenseText: '', hasResult: false, totalText: '0.00', balances: [], settlements: [], error: '' }); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
