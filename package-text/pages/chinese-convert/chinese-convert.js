const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');
const { MAX_TEXT_LENGTH, convertChinese } = require('../../utils/chinese-convert');

const TOOL = { key: 'chinese-convert', title: '繁简转换', desc: '简体与繁体文字本地互转', icon: 'chinese-convert', tone: 'green', page: '/package-text/pages/chinese-convert/chinese-convert' };
const MODES = [
  { key: 's2t', title: '简体转繁体' },
  { key: 't2s', title: '繁体转简体' }
];

Page({
  data: {
    maxLength: MAX_TEXT_LENGTH,
    modes: MODES,
    mode: 's2t',
    inputText: '',
    inputCount: 0,
    resultText: '',
    resultCount: 0,
    hasResult: false,
    error: '',
    saving: false,
    saved: false
  },

  onLoad(options = {}) {
    this.unloaded = false;
    this._revision = 0;
    if (!options.recordId) return;
    let record;
    try {
      record = app.getOperationRecord(decodeURIComponent(options.recordId));
    } catch (error) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    const inputLength = record && typeof record.text === 'string' ? Array.from(record.text).length : -1;
    const resultLength = record && typeof record.convertedText === 'string' ? Array.from(record.convertedText).length : -1;
    if (!record || record.key !== TOOL.key || !['s2t', 't2s'].includes(record.convertMode) || inputLength < 1 || inputLength > MAX_TEXT_LENGTH || resultLength < 0 || resultLength > MAX_TEXT_LENGTH) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    this._resultInput = { text: record.text, mode: record.convertMode };
    this._savedSignature = `${record.text}\u0000${record.convertMode}\u0000${record.convertedText}`;
    this.setData({
      mode: record.convertMode,
      inputText: record.text,
      inputCount: inputLength,
      resultText: record.convertedText,
      resultCount: resultLength,
      hasResult: true,
      saved: true
    });
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  invalidate(patch = {}) {
    this._revision += 1;
    this._resultInput = null;
    this._savedSignature = '';
    this.setData({ resultText: '', resultCount: 0, hasResult: false, error: '', saving: false, saved: false, ...patch });
  },

  onTextInput(event) {
    const inputText = String(event && event.detail ? event.detail.value || '' : '');
    this.invalidate({ inputText, inputCount: Array.from(inputText).length });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 's2t' && mode !== 't2s') return;
    this.invalidate({ mode });
  },

  convert() {
    if (this.data.saving) return;
    if (!this.data.inputText.trim()) {
      const error = '请先输入或粘贴文字';
      this.setData({ error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    try {
      const resultText = convertChinese(this.data.inputText, this.data.mode);
      this._resultInput = { text: this.data.inputText, mode: this.data.mode };
      this.setData({ resultText, resultCount: Array.from(resultText).length, hasResult: true, error: '', saved: false });
    } catch (error) {
      this.invalidate({ error: error.message || '转换失败，请检查输入' });
    }
  },

  copyResult() {
    if (!this.data.hasResult) return;
    wx.setClipboardData({
      data: this.data.resultText,
      success: () => wx.showToast({ title: '结果已复制' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },

  clearAll() {
    this.invalidate({ inputText: '', inputCount: 0 });
  },

  async saveRecord() {
    if (!this.data.hasResult || !this._resultInput || this.data.saving) return;
    const revision = this._revision;
    const resultInput = { ...this._resultInput };
    const resultText = this.data.resultText;
    const signature = `${resultInput.text}\u0000${resultInput.mode}\u0000${resultText}`;
    if (this._savedSignature === signature) return wx.showToast({ title: '当前结果已保存', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({
        ...TOOL,
        modeLabel: resultInput.mode === 's2t' ? '简体转繁体' : '繁体转简体',
        detailText: `${Array.from(resultInput.text).length} 个字符`,
        text: resultInput.text,
        convertedText: resultText,
        convertMode: resultInput.mode
      });
      if (this.unloaded || revision !== this._revision) return;
      this._savedSignature = signature;
      this.setData({ saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (error) {
      if (!this.unloaded && revision === this._revision) wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      if (!this.unloaded && revision === this._revision) this.setData({ saving: false });
    }
  },

  onUnload() {
    this.unloaded = true;
    this._revision += 1;
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
