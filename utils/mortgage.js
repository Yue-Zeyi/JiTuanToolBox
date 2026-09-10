// Fixed-rate monthly amortization. Monetary values are rounded to cents per period.
const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
function numeric(value, label, min, max, integer = false) {
  if (!/^\d+(?:\.\d+)?$/.test(String(value).trim())) throw new Error('请填写' + label);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(label + '范围为 ' + min + '—' + max + (integer ? '（整数）' : ''));
  return n;
}
function installment(principal, rate, months) {
  return rate === 0 ? principal / months : principal * rate / (-Math.expm1(-months * Math.log1p(rate)));
}
function schedule(principal, rate, months, mode, fixed) {
  if (principal === 0) return [];
  const unit = fixed === undefined ? (mode === 'annuity' ? installment(principal, rate, months) : principal / months) : fixed;
  let balance = principal;
  const rows = [];
  for (let i = 1; i <= months && balance > 0; i++) {
    const interest = cents(balance * rate);
    let capital = cents(mode === 'annuity' ? cents(unit) - interest : unit);
    capital = i === months ? balance : Math.min(balance, Math.max(0.01, capital));
    balance = cents(balance - capital);
    rows.push({ period: i, capital, interest, payment: cents(capital + interest), balance });
  }
  return rows;
}
const interestOf = rows => cents(rows.reduce((sum, row) => sum + row.interest, 0));
function calculateMortgage(input) {
  const principal = cents(numeric(input.amount, '贷款金额（万元）', 0.01, 100000) * 10000);
  const years = numeric(input.years, '贷款年限', 1, 30, true);
  const rate = numeric(input.rate, '年利率（%）', 0, 30) / 1200;
  if (!['annuity', 'principal'].includes(input.mode)) throw new Error('请选择还款方式');
  const months = years * 12;
  const rows = schedule(principal, rate, months, input.mode);
  const totalInterest = interestOf(rows);
  const result = { principal, months, rows, totalInterest, total: cents(principal + totalInterest), first: rows[0].payment, last: rows[rows.length - 1].payment };
  if (!input.prepay) return result;
  const paid = numeric(input.paid, '已还期数', 0, months - 1, true);
  if (paid >= rows.length) throw new Error('该期数下贷款已结清，无需提前还款');
  const balance = paid ? rows[paid - 1].balance : principal;
  const amount = cents(numeric(input.prepayAmount, '提前还本金（万元）', 0.000001, 100000) * 10000);
  if (amount <= 0 || amount > balance) throw new Error('提前还本金须大于 0 且不超过剩余本金 ' + balance.toFixed(2) + ' 元');
  const fee = cents(numeric(input.fee === '' ? 0 : input.fee, '提前还款费用（元）', 0, 100000000));
  const remaining = cents(balance - amount);
  const remainingMonths = months - paid;
  const baselineInterest = interestOf(rows.slice(paid));
  const fixed = input.mode === 'annuity' ? installment(principal, rate, months) : principal / months;
  result.prepayment = { paid, balance, amount, fee, remaining, baselineInterest, plans: ['reduce', 'shorten'].map(key => {
    const nextRows = schedule(remaining, rate, remainingMonths, input.mode, key === 'shorten' ? fixed : undefined)
      .map(row => ({ ...row, period: row.period + paid }));
    const interest = interestOf(nextRows);
    const saved = cents(baselineInterest - interest);
    return { key, rows: nextRows, months: nextRows.length, reducedMonths: remainingMonths - nextRows.length, interest, saved, netSaved: cents(saved - fee), first: nextRows.length ? nextRows[0].payment : 0, last: nextRows.length ? nextRows[nextRows.length - 1].payment : 0 };
  }) };
  return result;
}
module.exports = { calculateMortgage };
