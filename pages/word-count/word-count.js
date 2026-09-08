const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const WORD_COUNT_TOOL = { key: 'word-count', title: '字数统计', desc: '统计字符、字母和行数', icon: 'word-count', tone: 'blue', page: '/pages/word-count/word-count' };
const MAX_TEXT_LENGTH = 100000;
const PUNCTUATION_RANGES = [
  [0x21, 0x2F], [0x3A, 0x40], [0x5B, 0x60], [0x7B, 0x7E],
  [0x2000, 0x206F], [0x2E00, 0x2E7F], [0x3000, 0x303F],
  [0xFE10, 0xFE1F], [0xFE30, 0xFE4F], [0xFF01, 0xFF65]
];

function isPunctuation(character) {
  const codePoint = character.codePointAt(0);
  return PUNCTUATION_RANGES.some(range => codePoint >= range[0] && codePoint <= range[1]);
}

function utf8ByteLength(text) {
  return Array.from(text).reduce((total, character) => {
    const codePoint = character.codePointAt(0);
    return total + (codePoint <= 0x7F ? 1 : (codePoint <= 0x7FF ? 2 : (codePoint <= 0xFFFF ? 3 : 4)));
  }, 0);
}

function countText(value) {
  const text = String(value || '');
  const charactersArray = Array.from(text);
  const characters = charactersArray.length;
  const noLineBreak = charactersArray.filter(character => !/[\r\n]/.test(character)).length;
  const noSpaceLineBreak = charactersArray.filter(character => !/\s/.test(character)).length;
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const numbers = (text.match(/[0-9]/g) || []).length;
  const punctuation = charactersArray.filter(character => !/\s/.test(character) && isPunctuation(character)).length;
  const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
  return { characters, noLineBreak, noSpaceLineBreak, chinese, letters, numbers, punctuation, lines, utf8Bytes: utf8ByteLength(text), utf16Bytes: text.length * 2 };
}

Page({
  data: {
    text: '',
    stats: countText('')
  },

  onLoad(options) {
    this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : '';
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/word-count/word-count' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || typeof record.text !== 'string') return;
    const text = record.text;
    this.restoredHistoryRecordId = recordId;
    this.lastRecordedText = text;
    this.setData({ text, stats: countText(text) });
  },

  onTextInput(event) {
    const text = event && event.detail ? String(event.detail.value || '') : '';
    const characterCount = Array.from(text).length;
    this.setData({ text, stats: countText(text) });
    if (characterCount >= MAX_TEXT_LENGTH && !this.limitNotified) {
      this.limitNotified = true;
      wx.showToast({ title: '已达到最大输入长度', icon: 'none' });
    } else if (characterCount < MAX_TEXT_LENGTH) {
      this.limitNotified = false;
    }
  },

  clearText() {
    if (!this.data.text) return wx.showToast({ title: '当前没有可清空的文字', icon: 'none' });
    this.lastRecordedText = '';
    this.limitNotified = false;
    this.setData({ text: '', stats: countText('') });
    wx.showToast({ title: '已清空文字', icon: 'none' });
  },

  saveRecord() {
    const text = this.data.text;
    if (!text) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (this.lastRecordedText === text) return wx.showToast({ title: '当前内容已保存', icon: 'none' });
    this.lastRecordedText = text;
    app.recordRecent(WORD_COUNT_TOOL);
    app.recordOperation({
      ...WORD_COUNT_TOOL,
      modeLabel: '本地统计',
      detailText: `${this.data.stats.characters} 个字符 · ${this.data.stats.lines} 行`,
      text,
      stats: this.data.stats
    }).then(() => wx.showToast({ title: '已保存到操作记录' })).catch(() => {
      this.lastRecordedText = '';
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});
