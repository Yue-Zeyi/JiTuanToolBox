const ACTIVITIES = [
  { title: '久坐 · 很少运动', factor: 1.2 },
  { title: '轻度 · 每周运动 1—3 天', factor: 1.375 },
  { title: '中度 · 每周运动 3—5 天', factor: 1.55 },
  { title: '较高 · 每周运动 6—7 天', factor: 1.725 },
  { title: '很高 · 高强度训练或体力劳动', factor: 1.9 }
];
function number(value, label, min, max) {
  if (!/^\d+(?:\.\d+)?$/.test(String(value).trim())) throw new Error('请填写' + label);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + '范围为 ' + min + '—' + max);
  return n;
}
function calculateBmi(input) {
  const height = number(input.height, '身高（cm）', 100, 250);
  const weight = number(input.weight, '体重（kg）', 20, 400);
  const age = number(input.age, '年龄（周岁）', 18, 120);
  if (!Number.isInteger(age)) throw new Error('年龄请填写整数周岁');
  if (!['male', 'female'].includes(input.sex)) throw new Error('请选择公式所用性别');
  const activity = ACTIVITIES[Number(input.activity)];
  if (!activity || !Number.isInteger(Number(input.activity))) throw new Error('请选择活动水平');
  const squared = (height / 100) ** 2;
  const bmi = weight / squared;
  const category = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常范围' : bmi < 28 ? '超重' : '肥胖范围';
  const fat = 1.2 * bmi + 0.23 * age - (input.sex === 'male' ? 10.8 : 0) - 5.4;
  const resting = 10 * weight + 6.25 * height - 5 * age + (input.sex === 'male' ? 5 : -161);
  return { bmi, category, fat: fat > 0 && fat < 100 ? fat : null, resting: resting > 0 ? resting : null, calories: resting > 0 ? resting * activity.factor : null, low: 18.5 * squared, high: 24 * squared, reference: 22 * squared, activity: activity.title, factor: activity.factor };
}
module.exports = { calculateBmi, ACTIVITIES };
