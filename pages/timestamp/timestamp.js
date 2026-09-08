const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { MAX_ROWS, convertBatch, convertDateTime, convertTimestamp, formatRows, offsetLabel } = require('../../utils/timestamp');

const TOOL = { key: 'timestamp', title: '时间戳转换', desc: '时间戳与日期批量互转', icon: 'timestamp', tone: 'blue', page: '/pages/timestamp/timestamp' };
const MODES = [{ key: 'timestamp', title: '时间戳转日期' }, { key: 'date', title: '日期转时间戳' }];
const UNITS = [{ key: 'auto', title: '自动识别' }, { key: 'seconds', title: '秒' }, { key: 'milliseconds', title: '毫秒' }];
const COMMON_ZONE_NAMES = { '-8': '北美西部', '-5': '北美东部', 0: 'UTC', 8: '北京时间', 9: '日本/韩国' };
const TIMEZONES = Array.from({ length: 27 }, (_, index) => index - 12).map(value => ({
  value,
  title: offsetLabel(value),
  desc: COMMON_ZONE_NAMES[value] || '固定偏移'
}));

Page({
  data: {
    modes: MODES,
    units: UNITS,
    timezones: TIMEZONES,
    timezoneIndex: 20,
    mode: 'timestamp',
    unit: 'auto',
    offset: 8,
    inputText: '',
    inputCount: 0,
    selectedDate: '',
    selectedTime: '00:00',
    selectedSecond: 0,
    secondOptions: Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')),
    rows: [],
    resultText: '',
    hasResult: false,
    error: '',
    currentSeconds: '',
    currentMilliseconds: '',
    saving: false,
    saved: false,
    maxRows: MAX_ROWS
  },

  onLoad(options = {}) {
    this.unloaded = false;
    this._revision = 0;
    this.updateNow();
    this.selectCurrentDate();
    if (!options.recordId) return;
    let record;
    try {
      record = app.getOperationRecord(decodeURIComponent(options.recordId));
    } catch (error) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    const input = record && record.timestampInput;
    const inputCount = input && typeof input.inputText === 'string' && input.inputText ? input.inputText.split(/\r?\n/).length : 0;
    if (!record || record.key !== TOOL.key || !input || !['timestamp', 'date'].includes(input.mode) || !['auto', 'seconds', 'milliseconds'].includes(input.unit) || !Number.isInteger(input.offset) || input.offset < -12 || input.offset > 14 || inputCount < 1 || inputCount > MAX_ROWS) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    const timezoneIndex = TIMEZONES.findIndex(item => item.value === input.offset);
    this.setData({ mode: input.mode, unit: input.unit, offset: input.offset, timezoneIndex, inputText: input.inputText, inputCount }, () => {
      if (input.mode === 'date') this.syncDatePicker();
      this.convert();
    });
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
    this.updateNow();
    if (!this.clockTimer) this.clockTimer = setInterval(() => this.updateNow(), 1000);
  },

  onHide() { this.stopClock(); },
  onUnload() {
    this.unloaded = true;
    this._revision += 1;
    this.stopClock();
  },

  updateNow() {
    const milliseconds = Date.now();
    this.setData({ currentSeconds: String(Math.floor(milliseconds / 1000)), currentMilliseconds: String(milliseconds) });
  },

  stopClock() {
    if (!this.clockTimer) return;
    clearInterval(this.clockTimer);
    this.clockTimer = null;
  },

  invalidate(patch = {}) {
    this._revision += 1;
    this._resultInput = null;
    this.setData({ rows: [], resultText: '', hasResult: false, error: '', saving: false, saved: false, ...patch });
  },

  onInput(event) {
    const inputText = String(event && event.detail ? event.detail.value || '' : '');
    this.invalidate({ inputText, inputCount: inputText ? inputText.split(/\r?\n/).length : 0 });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'timestamp' || mode === 'date') {
      this.invalidate({ mode });
      if (mode === 'date') this.syncDatePicker();
    }
  },

  selectUnit(event) {
    const unit = event.currentTarget.dataset.unit;
    if (['auto', 'seconds', 'milliseconds'].includes(unit)) this.invalidate({ unit });
  },

  onTimezoneChange(event) {
    const timezoneIndex = Number(event.detail.value);
    const option = TIMEZONES[timezoneIndex];
    if (option) this.invalidate({ timezoneIndex, offset: option.value });
  },

  selectCurrentDate() {
    const local = convertTimestamp(String(Date.now()), 'milliseconds', this.data.offset).local;
    this.setData({ selectedDate: local.slice(0, 10), selectedTime: local.slice(11, 16), selectedSecond: Number(local.slice(17, 19)) });
  },

  syncDatePicker() {
    try {
      const first = this.data.inputText.split(/\r?\n/)[0];
      const local = convertDateTime(first, this.data.offset).local;
      this.setData({ selectedDate: local.slice(0, 10), selectedTime: local.slice(11, 16), selectedSecond: Number(local.slice(17, 19)) });
    } catch (error) { this.selectCurrentDate(); }
  },

  onDateChange(event) { this.setData({ selectedDate: event.detail.value }); },
  onTimeChange(event) { this.setData({ selectedTime: event.detail.value }); },
  onSecondChange(event) { this.setData({ selectedSecond: Number(event.detail.value) }); },

  useSelectedDate(event) {
    if (this.data.mode !== 'date') return;
    try {
      const second = Number(this.data.selectedSecond);
      if (!Number.isInteger(second) || second < 0 || second > 59) throw new Error('秒数须为 0-59');
      const selected = `${this.data.selectedDate} ${this.data.selectedTime}:${String(second).padStart(2, '0')}`;
      convertDateTime(selected, this.data.offset);
      const append = event.currentTarget.dataset.action === 'append';
      const previous = this.data.inputText.replace(/[\r\n]+$/, '');
      const inputText = append && previous ? `${previous}\n${selected}` : selected;
      const inputCount = inputText.split(/\r?\n/).length;
      if (inputCount > MAX_ROWS) throw new Error(`每次最多转换 ${MAX_ROWS} 行`);
      this.invalidate({ inputText, inputCount });
    } catch (error) { this.setData({ error: error.message }); }
  },

  convert() {
    if (this.data.saving) return;
    if (!this.data.inputText.trim()) {
      const error = this.data.mode === 'date' ? '请先选择并填入日期时间' : '请先输入时间戳';
      this.setData({ error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const options = { mode: this.data.mode, unit: this.data.unit, offset: this.data.offset };
      const rows = convertBatch(this.data.inputText, options);
      const resultText = formatRows(rows);
      this._resultInput = { ...options, inputText: this.data.inputText };
      this.setData({ rows, resultText, hasResult: true, error: '', saved: false });
    } catch (error) {
      this.invalidate({ error: error.message || '转换失败，请检查输入' });
    }
  },

  copyCurrent(event) {
    const unit = event.currentTarget.dataset.unit;
    const data = unit === 'milliseconds' ? this.data.currentMilliseconds : this.data.currentSeconds;
    wx.setClipboardData({ data, success: () => wx.showToast({ title: '当前时间戳已复制' }) });
  },

  copyAll() {
    if (!this.data.hasResult) return;
    wx.setClipboardData({
      data: this.data.resultText,
      success: () => wx.showToast({ title: '转换结果已复制' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },

  clearAll() {
    this.invalidate({ inputText: '', inputCount: 0 });
  },

  async saveRecord() {
    if (!this.data.hasResult || !this._resultInput || this.data.saving || this.data.saved) return;
    const revision = this._revision;
    const resultInput = { ...this._resultInput };
    const resultText = this.data.resultText;
    const resultRows = this.data.rows.map(row => ({ ...row }));
    this.setData({ saving: true });
    try {
      await app.recordOperation({
        ...TOOL,
        modeLabel: resultInput.mode === 'timestamp' ? '时间戳转日期' : '日期转时间戳',
        detailText: `${resultRows.length} 行 · ${offsetLabel(resultInput.offset)} 固定偏移`,
        text: resultText,
        timestampInput: resultInput,
        timestampRows: resultRows
      });
      if (this.unloaded || revision !== this._revision) return;
      this.setData({ saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (error) {
      if (!this.unloaded && revision === this._revision) wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      if (!this.unloaded && revision === this._revision) this.setData({ saving: false });
    }
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
