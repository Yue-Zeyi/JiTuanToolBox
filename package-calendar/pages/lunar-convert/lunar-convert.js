const app = getApp();
const { MAX_YEAR, MIN_YEAR, getLeapMonth, lunarToSolar, solarToLunar } = require('../../utils/lunar-convert');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');

const TOOL = { key: 'lunar-convert', title: '农历转换', desc: '公历农历双向转换与干支查询', icon: 'lunar-convert', tone: 'purple', page: '/package-calendar/pages/lunar-convert/lunar-convert' };
const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => ({ value: MIN_YEAR + index, label: `${MIN_YEAR + index}年` }));
const months = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'].map((label, index) => ({ value: index + 1, label }));
const days = Array.from({ length: 30 }, (_, index) => ({ value: index + 1, label: `${index + 1}日` }));
const pad = value => String(value).padStart(2, '0');

function initialData() {
  const now = new Date();
  const year = Math.max(MIN_YEAR, Math.min(MAX_YEAR, now.getFullYear()));
  const solarDate = `${year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const lunar = solarToLunar(solarDate);
  const leapMonth = getLeapMonth(lunar.lunarYear);
  return { solarDate, lunarYearIndex: lunar.lunarYear - MIN_YEAR, lunarMonthIndex: lunar.lunarMonth - 1, lunarDayIndex: lunar.lunarDay - 1, leapMonth, leapLabel: leapMonth ? `该年闰${months[leapMonth - 1].label}` : '该年没有闰月' };
}

Page({
  data: { mode: 'solar', years, months, days, minDate: `${MIN_YEAR}-01-31`, maxDate: `${MAX_YEAR}-12-31`, ...initialData(), isLeap: false, result: null, resultText: '', error: '', saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    const input = record && record.lunarInput;
    if (!record || record.key !== TOOL.key || !input) return;
    const patch = { mode: input.mode === 'lunar' ? 'lunar' : 'solar', isLeap: Boolean(input.isLeap) };
    if (patch.mode === 'solar') patch.solarDate = input.solarDate;
    else {
      patch.lunarYearIndex = Number(input.year) - MIN_YEAR;
      patch.lunarMonthIndex = Number(input.month) - 1;
      patch.lunarDayIndex = Number(input.day) - 1;
      patch.leapMonth = getLeapMonth(Number(input.year));
      patch.leapLabel = patch.leapMonth ? `该年闰${months[patch.leapMonth - 1].label}` : '该年没有闰月';
    }
    this.setData(patch, () => { this.convert(); this.setData({ saved: true }); });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  selectMode(event) { this.setData({ mode: event.currentTarget.dataset.mode, result: null, resultText: '', error: '', saved: false }); },
  changeSolar(event) { this.setData({ solarDate: event.detail.value, result: null, resultText: '', error: '', saved: false }); },
  changeYear(event) {
    const lunarYearIndex = Number(event.detail.value); const year = years[lunarYearIndex].value; const leapMonth = getLeapMonth(year);
    this.setData({ lunarYearIndex, leapMonth, leapLabel: leapMonth ? `该年闰${months[leapMonth - 1].label}` : '该年没有闰月', isLeap: false, result: null, resultText: '', error: '', saved: false });
  },
  changeMonth(event) { const lunarMonthIndex = Number(event.detail.value); this.setData({ lunarMonthIndex, isLeap: false, result: null, resultText: '', error: '', saved: false }); },
  changeDay(event) { this.setData({ lunarDayIndex: Number(event.detail.value), result: null, resultText: '', error: '', saved: false }); },
  toggleLeap(event) { this.setData({ isLeap: Boolean(event.detail.value), result: null, resultText: '', error: '', saved: false }); },
  convert() {
    try {
      const input = this.data.mode === 'solar'
        ? { mode: 'solar', solarDate: this.data.solarDate }
        : { mode: 'lunar', year: years[this.data.lunarYearIndex].value, month: months[this.data.lunarMonthIndex].value, day: days[this.data.lunarDayIndex].value, isLeap: this.data.isLeap };
      const result = input.mode === 'solar' ? solarToLunar(input.solarDate) : lunarToSolar(input.year, input.month, input.day, input.isLeap);
      const resultText = `公历：${result.solarDisplay} ${result.week}\n农历：${result.lunarDate}\n干支：${result.ganZhiYear}年 ${result.ganZhiMonth}月 ${result.ganZhiDay}日\n生肖：${result.zodiac}\n节气：${result.jieQi}\n节日：${result.festivals}`;
      this._input = input;
      this.setData({ result, resultText, error: '', saved: false });
      app.recordRecent(TOOL);
    } catch (error) { this.setData({ result: null, resultText: '', error: error.message || '日期转换失败', saved: false }); }
  },
  copyResult() { if (this.data.resultText) wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) }); },
  async saveRecord() {
    if (!this.data.result || !this._input || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次结果已保存' : '请先完成转换', icon: 'none' });
    this.setData({ saving: true });
    try { await app.recordOperation({ ...TOOL, lunarInput: this._input, modeLabel: this._input.mode === 'solar' ? '公历转农历' : '农历转公历', detailText: `${this.data.result.solarDate} · 农历${this.data.result.lunarMonth}月${this.data.result.lunarDay}日`, text: this.data.resultText }); this.setData({ saving: false, saved: true }); wx.showToast({ title: '已保存到操作记录' }); }
    catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
