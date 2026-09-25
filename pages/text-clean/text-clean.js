const app = getApp();
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MAX_TEXT_LENGTH = 100000;
const TEXT_CLEAN_TOOL = { key: 'text-clean', title: '文本清洗', desc: '清理格式，整理出干净文本', icon: 'text-clean', tone: 'green', page: '/pages/text-clean/text-clean' };
const DEFAULT_ACTIVE_KEYS = ['collapse-spaces', 'trim-spaces', 'remove-blank-lines'];
const PUNCTUATION_RANGES = [
  [0x21, 0x2F], [0x3A, 0x40], [0x5B, 0x60], [0x7B, 0x7E],
  [0x2000, 0x206F], [0x2E00, 0x2E7F], [0x3000, 0x303F],
  [0xFE10, 0xFE1F], [0xFE30, 0xFE4F], [0xFF01, 0xFF65]
];
const OPTION_DEFINITIONS = [
  { key: 'collapse-spaces', title: '去除多余空格', desc: '连续空格合并为一个' },
  { key: 'trim-spaces', title: '去除首尾空格', desc: '清除每行两端空白' },
  { key: 'remove-blank-lines', title: '去除空行', desc: '移除没有内容的行' },
  { key: 'remove-special', title: '去除特殊字符', desc: '移除表情及异常符号' },
  { key: 'remove-html', title: '去除 HTML 标签', desc: '保留文字，移除标签' },
  { key: 'remove-numbers', title: '去除数字', desc: '删除半角和全角数字' },
  { key: 'remove-punctuation', title: '去除标点符号', desc: '移除中英文标点' },
  { key: 'remove-duplicate-lines', title: '按行去重', desc: '保留每行第一次出现', group: 'line' },
  { key: 'duplicate-lines-only', title: '只保留重复行', desc: '找出出现多次的行', group: 'line' },
  { key: 'sort-lines-asc', title: '按行升序', desc: '按文字顺序排列', group: 'line-sort' },
  { key: 'sort-lines-desc', title: '按行降序', desc: '按文字倒序排列', group: 'line-sort' },
  { key: 'add-line-numbers', title: '添加行号', desc: '为每行添加序号' },
  { key: 'comma-to-lines', title: '分隔符转换为换行', desc: '逗号分号拆成多行', group: 'delimiter' },
  { key: 'lines-to-comma', title: '换行转换为逗号', desc: '多行合并为一行', group: 'delimiter' },
  { key: 'lowercase', title: '转换为小写', desc: '英文统一转换为小写', group: 'case' },
  { key: 'uppercase', title: '转换为大写', desc: '英文统一转换为大写', group: 'case' },
  { key: 'title-case', title: '转换为标题大小写', desc: '英文单词首字母大写', group: 'case' }
];

function createOptions(activeKeys = DEFAULT_ACTIVE_KEYS) {
  const activeSet = new Set(activeKeys);
  return OPTION_DEFINITIONS.map(item => ({ ...item, active: activeSet.has(item.key) }));
}

function isPunctuation(character) {
  const codePoint = character.codePointAt(0);
  return PUNCTUATION_RANGES.some(range => codePoint >= range[0] && codePoint <= range[1]);
}

function mapLines(text, mapper) {
  return String(text).split(/(\r\n|\r|\n)/).map((part, index) => index % 2 ? part : mapper(part)).join('');
}

function removeSpecialCharacters(text) {
  return Array.from(text).filter(character => {
    if (/[\u200B-\u200D\uFEFF]/.test(character)) return false;
    if (/\s/.test(character) || isPunctuation(character)) return true;
    const codePoint = character.codePointAt(0);
    return (codePoint >= 0x30 && codePoint <= 0x39)
      || (codePoint >= 0x41 && codePoint <= 0x5A)
      || (codePoint >= 0x61 && codePoint <= 0x7A)
      || (codePoint >= 0xC0 && codePoint <= 0x024F)
      || (codePoint >= 0x3040 && codePoint <= 0x30FF)
      || (codePoint >= 0x3400 && codePoint <= 0x9FFF)
      || (codePoint >= 0xAC00 && codePoint <= 0xD7AF)
      || (codePoint >= 0xFF10 && codePoint <= 0xFF19)
      || (codePoint >= 0xFF21 && codePoint <= 0xFF3A)
      || (codePoint >= 0xFF41 && codePoint <= 0xFF5A);
  }).join('');
}

function removePunctuation(text) {
  return Array.from(text).filter(character => /\s/.test(character) || !isPunctuation(character)).join('');
}

function toTitleCase(text) {
  return text.replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllText(source, findText, replaceText, useRegex) {
  const pattern = useRegex ? String(findText) : escapeRegExp(findText);
  if (!pattern) throw new Error('请输入要查找的内容');
  let expression;
  try {
    expression = new RegExp(pattern, 'g');
  } catch (error) {
    throw new Error('正则表达式格式有误');
  }
  return useRegex
    ? String(source).replace(expression, String(replaceText))
    : String(source).replace(expression, () => String(replaceText));
}

function cleanText(value, options) {
  const active = new Set(options.filter(item => item.active).map(item => item.key));
  let result = String(value || '');
  if (active.has('remove-html')) result = result.replace(/<[^>]*>/g, '');
  if (active.has('remove-special')) result = removeSpecialCharacters(result);
  if (active.has('remove-numbers')) result = result.replace(/[0-9０-９]/g, '');
  if (active.has('remove-punctuation')) result = removePunctuation(result);
  if (active.has('collapse-spaces')) result = mapLines(result, line => line.replace(/[ \t\f\v\u00a0\u3000]+/g, ' '));
  if (active.has('trim-spaces')) result = mapLines(result, line => line.replace(/^[ \t\f\v\u00a0\u3000]+|[ \t\f\v\u00a0\u3000]+$/g, ''));
  if (active.has('remove-blank-lines')) {
    const separator = result.match(/\r\n|\r|\n/);
    const lineSeparator = separator ? separator[0] : '\n';
    result = result.split(/\r\n|\r|\n/).filter(line => line.trim()).join(lineSeparator);
  }
  if (active.has('comma-to-lines')) result = result.replace(/[，,；;]+/g, '\n');
  if (active.has('lines-to-comma')) result = result.split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean).join('，');
  if (active.has('remove-duplicate-lines') || active.has('duplicate-lines-only') || active.has('sort-lines-asc') || active.has('sort-lines-desc') || active.has('add-line-numbers')) {
    const separator = result.match(/\r\n|\r|\n/);
    const lineSeparator = separator ? separator[0] : '\n';
    let lines = result.split(/\r\n|\r|\n/);
    if (active.has('duplicate-lines-only')) {
      const counts = lines.reduce((map, line) => map.set(line, (map.get(line) || 0) + 1), new Map());
      lines = lines.filter(line => (counts.get(line) || 0) > 1);
    }
    if (active.has('remove-duplicate-lines')) lines = Array.from(new Set(lines));
    if (active.has('sort-lines-asc')) lines = lines.slice().sort((a, b) => a.localeCompare(b, 'zh-Hans'));
    if (active.has('sort-lines-desc')) lines = lines.slice().sort((a, b) => b.localeCompare(a, 'zh-Hans'));
    if (active.has('add-line-numbers')) lines = lines.map((line, index) => `${index + 1}. ${line}`);
    result = lines.join(lineSeparator);
  }
  if (active.has('lowercase')) result = result.toLowerCase();
  if (active.has('uppercase')) result = result.toUpperCase();
  if (active.has('title-case')) result = toTitleCase(result);
  return result;
}

function getStats(input, output) {
  const inputCharacters = Array.from(input).length;
  const outputCharacters = Array.from(output).length;
  return { inputCharacters, outputCharacters, removedCharacters: Math.max(0, inputCharacters - outputCharacters) };
}

Page({
  data: {
    text: '',
    resultText: '',
    hasResult: false,
    options: createOptions(),
    activeCount: DEFAULT_ACTIVE_KEYS.length,
    stats: getStats('', ''),
    findText: '',
    replaceText: '',
    useRegex: false,
    replaceError: ''
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
    return getShareAppMessage({ path: '/pages/text-clean/text-clean' });
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
    const activeKeys = Array.isArray(record.cleanOptions) ? record.cleanOptions : DEFAULT_ACTIVE_KEYS;
    const options = createOptions(activeKeys);
    const resultText = cleanText(text, options);
    const replacement = record.replacement && typeof record.replacement === 'object' ? record.replacement : {};
    this.restoredHistoryRecordId = recordId;
    this.lastRecordedSignature = `${text}\u0000${activeKeys.join(',')}`;
    this.setData({ text, resultText, options, activeCount: options.filter(item => item.active).length, hasResult: Boolean(text), stats: getStats(text, resultText), findText: String(replacement.findText || ''), replaceText: String(replacement.replaceText || ''), useRegex: Boolean(replacement.useRegex), replaceError: '' });
  },

  updateResult(text, options = this.data.options) {
    const resultText = cleanText(text, options);
    this.setData({ text, resultText, options, activeCount: options.filter(item => item.active).length, hasResult: Boolean(text), stats: getStats(text, resultText) });
  },

  onTextInput(event) {
    const text = event && event.detail ? String(event.detail.value || '') : '';
    this.updateResult(text);
    if (Array.from(text).length >= MAX_TEXT_LENGTH && !this.limitNotified) {
      this.limitNotified = true;
      wx.showToast({ title: '已达到最大输入长度', icon: 'none' });
    } else if (Array.from(text).length < MAX_TEXT_LENGTH) {
      this.limitNotified = false;
    }
  },

  onFindInput(event) {
    this.setData({ findText: event && event.detail ? String(event.detail.value || '') : '', replaceError: '' });
  },

  onReplaceInput(event) {
    this.setData({ replaceText: event && event.detail ? String(event.detail.value || '') : '', replaceError: '' });
  },

  toggleRegex() {
    this.setData({ useRegex: !this.data.useRegex, replaceError: '' });
  },

  applyReplace() {
    if (!this.data.text) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (!this.data.findText) {
      this.setData({ replaceError: '请输入要查找的内容' });
      return wx.showToast({ title: '请输入要查找的内容', icon: 'none' });
    }
    let replaced;
    try {
      replaced = replaceAllText(this.data.text, this.data.findText, this.data.replaceText, this.data.useRegex);
    } catch (error) {
      const message = error && error.message ? error.message : '替换规则无效';
      this.setData({ replaceError: message });
      return wx.showToast({ title: message, icon: 'none' });
    }
    if (replaced === this.data.text) return wx.showToast({ title: '没有找到匹配内容', icon: 'none' });
    this.limitNotified = false;
    this.updateResult(replaced);
    track('text_replace', { tool: 'text-clean', regex: this.data.useRegex });
    wx.showToast({ title: '替换完成', icon: 'none' });
  },

  toggleOption(event) {
    const key = event.currentTarget.dataset.key;
    const selected = this.data.options.find(item => item.key === key);
    const options = this.data.options.map(item => {
      if (selected && selected.group && item.group === selected.group && item.key !== key && item.active) return { ...item, active: false };
      return item.key === key ? { ...item, active: !item.active } : item;
    });
    this.updateResult(this.data.text, options);
  },

  resetOptions() {
    this.updateResult(this.data.text, createOptions());
    wx.showToast({ title: '已恢复默认选项', icon: 'none' });
  },

  copyResult() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (!this.data.resultText) return wx.showToast({ title: '清洗后没有可复制内容', icon: 'none' });
    wx.setClipboardData({ data: this.data.resultText, success: () => { track('result_copy', { tool: 'text-clean' }); wx.showToast({ title: '结果已复制' }); } });
  },

  replaceOriginal() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (this.data.resultText === this.data.text) return wx.showToast({ title: '当前没有可替换的内容', icon: 'none' });
    this.limitNotified = false;
    this.updateResult(this.data.resultText);
    wx.showToast({ title: '已替换原文', icon: 'none' });
  },

  clearText() {
    if (!this.data.text) return wx.showToast({ title: '当前没有可清空的文字', icon: 'none' });
    this.limitNotified = false;
    this.setData({ text: '', resultText: '', hasResult: false, stats: getStats('', '') });
    wx.showToast({ title: '已清空文字', icon: 'none' });
  },

  saveRecord() {
    const text = this.data.text;
    if (!text) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    const activeKeys = this.data.options.filter(item => item.active).map(item => item.key);
    const signature = `${text}\u0000${activeKeys.join(',')}`;
    if (this.lastRecordedSignature === signature) return wx.showToast({ title: '当前内容已保存', icon: 'none' });
    this.lastRecordedSignature = signature;
    app.recordRecent(TEXT_CLEAN_TOOL);
    app.recordOperation({
      ...TEXT_CLEAN_TOOL,
      modeLabel: `${activeKeys.length} 项清洗规则`,
      detailText: `${this.data.stats.inputCharacters} → ${this.data.stats.outputCharacters} 字符`,
      text,
      cleanedText: this.data.resultText,
      cleanOptions: activeKeys,
      replacement: { findText: this.data.findText, replaceText: this.data.replaceText, useRegex: this.data.useRegex }
    }).then(() => wx.showToast({ title: '已保存到操作记录' })).catch(() => {
      this.lastRecordedSignature = '';
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});
