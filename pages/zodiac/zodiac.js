const app = getApp();
const { ANIMALS, getToday, getYearResult, getBirthdayResult, findZodiacYears } = require('../../utils/zodiac');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'zodiac', title: '生肖查询', icon: 'zodiac', tone: 'orange', page: '/pages/zodiac/zodiac' };
const MODES = ['year', 'birthday', 'reverse'];
const INPUT_FIELDS = ['birthYear', 'birthDate', 'includeTime', 'birthTime', 'birthSecond', 'animalIndex', 'rangeStart', 'rangeEnd'];
const describe = info => `${info.yearLabel} · 属${info.animal}\n天干五行：${info.stemElement}；纳音：${info.naYin}\n${info.benMingNianText}`;

Page({
  data: {
    mode: 'year', animals: ANIMALS, today: '', currentYear: '', birthYear: '', birthDate: '',
    includeTime: false, birthTime: '00:00', birthSecond: '', animalIndex: 0, rangeStart: '1900', rangeEnd: '',
    hasResult: false, yearResult: null, birthdayResult: null, reverseRows: [], resultText: '', error: '', saving: false
  },

  onLoad(options = {}) {
    const today = getToday();
    this.setData({ today, currentYear: today.slice(0, 4), rangeEnd: today.slice(0, 4) });
    if (!options.recordId) return;
    const record = app.getOperationRecord(options.recordId);
    if (!record || record.key !== TOOL.key || !record.zodiacInput || !MODES.includes(record.zodiacInput.mode)) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    const input = { mode: record.zodiacInput.mode };
    INPUT_FIELDS.forEach(key => { if (record.zodiacInput[key] !== undefined) input[key] = record.zodiacInput[key]; });
    this.setData(input, () => this.runQuery());
  },

  invalidate(patch = {}) {
    this._savedSignature = '';
    this.setData({ ...patch, hasResult: false, yearResult: null, birthdayResult: null, reverseRows: [], resultText: '', error: '' });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (MODES.includes(mode)) this.invalidate({ mode });
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    if (['birthYear', 'birthSecond', 'rangeStart', 'rangeEnd'].includes(field)) this.invalidate({ [field]: event.detail.value });
  },

  onDateChange(event) { this.invalidate({ birthDate: event.detail.value }); },
  onTimeChange(event) { this.invalidate({ birthTime: event.detail.value }); },
  onTimeToggle(event) { this.invalidate({ includeTime: Boolean(event.detail.value) }); },
  onAnimalChange(event) {
    const animalIndex = Number(event.detail.value);
    if (Number.isInteger(animalIndex) && animalIndex >= 0 && animalIndex < ANIMALS.length) this.invalidate({ animalIndex });
  },

  currentInput() {
    const input = { mode: this.data.mode };
    INPUT_FIELDS.forEach(key => { input[key] = this.data[key]; });
    return input;
  },

  runQuery() {
    const input = this.currentInput();
    const today = getToday();
    const currentYear = today.slice(0, 4);
    this.invalidate({ today, currentYear });
    try {
      let yearResult = null, birthdayResult = null, reverseRows = [], resultText;
      if (input.mode === 'year') {
        if (Number(input.birthYear) > Number(currentYear)) throw new Error('出生年份不能晚于今年');
        yearResult = getYearResult(input.birthYear);
        resultText = `生肖查询 · 年份参考\n${describe(yearResult)}\n年龄：${yearResult.ageText}\n${yearResult.boundaryNote}`;
      } else if (input.mode === 'birthday') {
        let time;
        if (input.includeTime) {
          time = input.birthTime;
          if (input.birthSecond !== '') {
            if (!/^\d{1,2}$/.test(input.birthSecond) || Number(input.birthSecond) > 59) throw new Error('秒数范围为 0 至 59');
            time += `:${String(Number(input.birthSecond)).padStart(2, '0')}`;
          }
        }
        birthdayResult = getBirthdayResult(input.birthDate, time);
        const lichunText = birthdayResult.isAmbiguous
          ? birthdayResult.lichunOptions.map((item, index) => `${index ? '立春后' : '立春前'}：${describe(item)}`).join('\n')
          : describe(birthdayResult.lichun);
        resultText = `生肖查询 · 公历生日\n${input.birthDate}${time ? ` ${time}（北京时间）` : ''}\n春节口径：${describe(birthdayResult.cny)}\n立春口径：${lichunText}\n年龄：${birthdayResult.ageText}\n春节：${birthdayResult.cnyDate}\n立春：${birthdayResult.liChunAt}（北京时间）\n${birthdayResult.boundaryNote}`;
      } else {
        reverseRows = findZodiacYears(ANIMALS[input.animalIndex], input.rangeStart, input.rangeEnd);
        resultText = `生肖年份反查 · 属${ANIMALS[input.animalIndex]}\n${input.rangeStart}—${input.rangeEnd} 年，共 ${reverseRows.length} 个年份\n${reverseRows.map(row => `${row.year}年 ${row.ganZhi} 天干五行${row.stemElement} 纳音${row.naYin} ${row.ageText}`).join('\n')}\n按春节后的农历年份参考，年初出生请按生日查询。`;
      }
      resultText += `\n年龄及本命年按 ${today}（北京时间）计算；传统历法信息，不作吉凶判断。`;
      this._resultInput = input;
      this.setData({ hasResult: true, yearResult, birthdayResult, reverseRows, resultText });
    } catch (error) {
      this.setData({ error: error.message || '查询失败，请检查输入' });
    }
  },

  copyResult() {
    if (!this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText, success: () => wx.showToast({ title: '结果已复制' }) });
  },

  clearResult() { this.invalidate(); },

  async saveRecord() {
    if (!this.data.hasResult || this.data.saving) return;
    const text = this.data.resultText;
    if (this._savedSignature === text) return wx.showToast({ title: '当前结果已保存', icon: 'none' });
    const modeLabel = { year: '按年份查询', birthday: '按生日查询', reverse: '生肖年份反查' }[this._resultInput.mode];
    const detailText = this._resultInput.mode === 'reverse' ? `${this._resultInput.rangeStart}—${this._resultInput.rangeEnd} 年` : '生肖、干支与五行查询';
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...TOOL, modeLabel, detailText, text, zodiacInput: { ...this._resultInput } });
      this._savedSignature = text;
      wx.showToast({ title: '已保存到操作记录' });
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally { this.setData({ saving: false }); }
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
