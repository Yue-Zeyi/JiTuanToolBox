const BRACKETS = [
  { max: 36000, rate: 0.03, deduction: 0 },
  { max: 144000, rate: 0.1, deduction: 2520 },
  { max: 300000, rate: 0.2, deduction: 16920 },
  { max: 420000, rate: 0.25, deduction: 31920 },
  { max: 660000, rate: 0.3, deduction: 52920 },
  { max: 960000, rate: 0.35, deduction: 85920 },
  { max: Infinity, rate: 0.45, deduction: 181920 }
];

function money(value, label) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label}需填写不小于 0 的数字`);
  return number;
}

function taxFor(taxableIncome) {
  const taxable = Math.max(0, Number(taxableIncome) || 0);
  const bracket = BRACKETS.find(item => taxable <= item.max);
  return Math.max(0, taxable * bracket.rate - bracket.deduction);
}

function calculateMonthly(input = {}) {
  const salary = money(input.salary, '税前月收入');
  const socialFund = money(input.socialFund, '五险一金');
  const special = money(input.special, '专项附加扣除');
  const other = money(input.other, '其他税前扣除');
  const month = Number(input.month);
  if (!salary) throw new Error('请输入税前月收入');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('计税月份需在 1 至 12 月之间');
  const monthlyTaxable = Math.max(0, salary - 5000 - socialFund - special - other);
  const cumulativeTaxable = monthlyTaxable * month;
  const previousTaxable = monthlyTaxable * (month - 1);
  const cumulativeTax = taxFor(cumulativeTaxable);
  const previousTax = taxFor(previousTaxable);
  const currentTax = Math.max(0, cumulativeTax - previousTax);
  const afterTax = Math.max(0, salary - socialFund - other - currentTax);
  return { mode: 'monthly', salary, socialFund, special, other, month, monthlyTaxable, cumulativeTaxable, cumulativeTax, currentTax, afterTax, effectiveRate: salary ? currentTax / salary * 100 : 0 };
}

function calculateAnnual(input = {}) {
  const income = money(input.income, '年度综合收入');
  const socialFund = money(input.socialFund, '年度五险一金');
  const special = money(input.special, '年度专项附加扣除');
  const other = money(input.other, '其他税前扣除');
  const prepaid = money(input.prepaid, '年度已预缴个税');
  if (!income) throw new Error('请输入年度综合收入');
  const taxableIncome = Math.max(0, income - 60000 - socialFund - special - other);
  const annualTax = taxFor(taxableIncome);
  const settlement = annualTax - prepaid;
  const afterTax = Math.max(0, income - socialFund - other - annualTax);
  return { mode: 'annual', income, socialFund, special, other, prepaid, taxableIncome, annualTax, settlement, afterTax, monthlyAverage: afterTax / 12, effectiveRate: income ? annualTax / income * 100 : 0 };
}

module.exports = { BRACKETS, taxFor, calculateMonthly, calculateAnnual };
