function numberValue(value, label) {
  if (value === '' || value === null || value === undefined) throw new Error('请输入' + label);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(label + '必须是有效数字');
  return number;
}

function nonNegative(value, label) {
  const number = numberValue(value, label);
  if (number < 0) throw new Error(label + '不能是负数');
  return number;
}

function display(value) {
  return String(Number(Number(value).toPrecision(15)));
}

function result(value, label, suffix, detail) {
  if (!Number.isFinite(value)) throw new Error('计算结果超出支持范围');
  return { value, label, text: label + '：' + display(value) + suffix + (detail ? '\n' + detail : '') };
}

function calculatePercentage(mode, values = {}) {
  if (mode === 'ratio') {
    const part = nonNegative(values.part, '部分数');
    const total = nonNegative(values.total, '总数');
    if (total === 0) throw new Error('总数不能为 0');
    return result(part / total * 100, '占比', '%', display(part) + ' ÷ ' + display(total) + ' × 100%');
  }
  if (mode === 'part') {
    const total = nonNegative(values.total, '总数');
    const percentage = nonNegative(values.percentage, '百分比');
    return result(total * percentage / 100, '部分数', '', display(total) + ' × ' + display(percentage) + '%');
  }
  if (mode === 'total') {
    const part = nonNegative(values.part, '部分数');
    const percentage = nonNegative(values.percentage, '百分比');
    if (percentage === 0) throw new Error('百分比不能为 0');
    return result(part / (percentage / 100), '总数', '', display(part) + ' ÷ ' + display(percentage) + '%');
  }
  if (mode === 'change') {
    const oldValue = numberValue(values.oldValue, '原值');
    const newValue = numberValue(values.newValue, '新值');
    if (oldValue === 0) throw new Error('原值不能为 0');
    const change = (newValue - oldValue) / Math.abs(oldValue) * 100;
    return result(change, '涨跌幅', '%', display(oldValue) + ' → ' + display(newValue));
  }
  if (mode === 'discount') {
    const price = nonNegative(values.price, '原价');
    const discountPercent = nonNegative(values.discountPercent, '优惠比例');
    if (discountPercent > 100) throw new Error('优惠比例不能超过 100%');
    return result(price * (1 - discountPercent / 100), '折扣后价格', '', '优惠 ' + display(discountPercent) + '%');
  }
  throw new Error('不支持的百分比计算模式');
}

module.exports = { calculatePercentage };
