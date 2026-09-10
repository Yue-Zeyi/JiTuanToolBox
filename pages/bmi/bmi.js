const { calculateBmi, ACTIVITIES } = require('../../utils/bmi');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
Page({
  data: { height: '', weight: '', age: '', sex: 'male', activity: 0, activities: ACTIVITIES, sexes: [{ key: 'male', title: '男性' }, { key: 'female', title: '女性' }], hasResult: false, error: '', resultText: '', metrics: [], showFormula: false },
  onShow() { const bar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (bar) bar.setData({ visible: false }); },
  invalidate(patch = {}) { this.setData({ hasResult: false, error: '', resultText: '', metrics: [], ...patch }); },
  onInput(event) { const key = event.currentTarget.dataset.key; if (['height', 'weight', 'age'].includes(key)) this.invalidate({ [key]: event.detail.value }); },
  selectSex(event) { const sex = event.currentTarget.dataset.sex; if (['male', 'female'].includes(sex)) this.invalidate({ sex }); },
  selectActivity(event) { this.invalidate({ activity: Number(event.detail.value) }); },
  toggleFormula() { this.setData({ showFormula: !this.data.showFormula }); },
  calculate() {
    try {
      const result = calculateBmi(this.data);
      const fixed = (value, digits = 1) => value === null ? '暂不适用' : value.toFixed(digits);
      const metrics = [
        { label: '体脂率估算', value: fixed(result.fat), unit: result.fat === null ? '' : '%', note: '公式估算，非实测体脂' },
        { label: '静息能量消耗', value: fixed(result.resting, 0), unit: result.resting === null ? '' : '千卡/天', note: '身体静息时的能量需求' },
        { label: '每日热量需求', value: fixed(result.calories, 0), unit: result.calories === null ? '' : '千卡/天', note: '维持当前体重的估算值' },
        { label: '理想体重参考', value: fixed(result.reference), unit: 'kg', note: '按 BMI 22 计算，非唯一目标' }
      ];
      const range = result.low.toFixed(1) + ' ≤ 体重 < ' + result.high.toFixed(1) + ' kg';
      const resultText = ['BMI 与身体指标（估算）', 'BMI：' + result.bmi.toFixed(2) + ' · ' + result.category, ...metrics.map(item => item.label + '：' + item.value + ' ' + item.unit), '一般成人正常 BMI 对应体重：' + range, '活动水平：' + result.activity, '仅供一般成人参考，体脂和热量非实测，不作为诊断或个体饮食处方。'].join('\n');
      this.setData({ hasResult: true, error: '', bmi: result.bmi.toFixed(2), category: result.category, metrics, range, factor: result.factor, resultText, older: Number(this.data.age) >= 65 });
    } catch (error) { this.invalidate({ error: error.message }); wx.showToast({ title: error.message, icon: 'none' }); }
  },
  clearAll() { this.invalidate({ height: '', weight: '', age: '' }); },
  copyResult() { if (this.data.hasResult) wx.setClipboardData({ data: this.data.resultText }); },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/bmi/bmi' }); },
  onShareTimeline() { return getShareTimeline(); }
});
