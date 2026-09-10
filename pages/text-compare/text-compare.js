const app = getApp();
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { outputName, saveNamedImageToAlbum } = require('../../utils/image-output');

const MAX_TEXT_LENGTH = 100000;
const DIFF_CELL_LIMIT = 1200000;
const TEXT_COMPARE_TOOL = { key: 'text-compare', title: '文字比对', desc: '对照两段文字，快速找出差异', icon: 'text-compare', tone: 'orange', page: '/pages/text-compare/text-compare' };
const PUNCTUATION_RANGES = [
  [0x21, 0x2F], [0x3A, 0x40], [0x5B, 0x60], [0x7B, 0x7E],
  [0x2000, 0x206F], [0x2E00, 0x2E7F], [0x3000, 0x303F],
  [0xFE10, 0xFE1F], [0xFE30, 0xFE4F], [0xFF01, 0xFF65]
];
const MODE_OPTIONS = [
  { key: 'char', title: '按字对比', desc: '逐字高亮，适合短文本' },
  { key: 'line', title: '按行对比', desc: '整行标记，适合长文本' }
];
const IGNORE_DEFINITIONS = [
  { key: 'spaces', title: '忽略空格', desc: '不比较空格差异' },
  { key: 'newlines', title: '忽略换行', desc: '不比较换行差异' },
  { key: 'case', title: '忽略大小写', desc: '英文大小写视为相同' },
  { key: 'punctuation', title: '忽略标点', desc: '不比较中英文标点' }
];

function isPunctuation(character) {
  const codePoint = character.codePointAt(0);
  return PUNCTUATION_RANGES.some(range => codePoint >= range[0] && codePoint <= range[1]);
}

function createIgnoreOptions(activeKeys = []) {
  const activeSet = new Set(activeKeys);
  return IGNORE_DEFINITIONS.map(item => ({ ...item, active: activeSet.has(item.key) }));
}

function ignoreState(options) {
  return options.reduce((state, item) => ({ ...state, [item.key]: Boolean(item.active) }), { spaces: false, newlines: false, case: false, punctuation: false });
}

function normalizeToken(value, ignores) {
  let key = String(value || '');
  if (ignores.newlines) key = key.replace(/\r\n|\r|\n/g, '');
  if (ignores.spaces) key = key.replace(/[ \t\f\v\u00a0\u3000]/g, '');
  if (ignores.punctuation) key = Array.from(key).filter(character => /\s/.test(character) || !isPunctuation(character)).join('');
  if (ignores.case) key = key.toLowerCase();
  return key;
}

function buildTokens(text, mode, ignores) {
  const source = String(text || '');
  if (!source) return [];
  if (mode === 'line' && !ignores.newlines) {
    const separators = source.match(/\r\n|\r|\n/g) || [];
    const lines = source.split(/\r\n|\r|\n/);
    return lines.map((line, index) => {
      const display = line + (index < separators.length ? separators[index] : '');
      const normalized = normalizeToken(line, ignores);
      return { key: normalized || (line.length ? '' : '\u0000'), text: display, units: 1 };
    }).filter(token => token.key || token.text);
  }
  return Array.from(source).map(character => ({ key: normalizeToken(character, ignores), text: character, units: 1 })).filter(token => token.key);
}

function mergeSegment(segments, type, text, units) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous && previous.type === type) {
    previous.text += text;
    previous.units += units;
  } else {
    segments.push({ type, text, units });
  }
}

function coarseDiff(original, comparison) {
  let prefix = 0;
  while (prefix < original.length && prefix < comparison.length && original[prefix].key === comparison[prefix].key) prefix += 1;
  let suffix = 0;
  while (suffix < original.length - prefix && suffix < comparison.length - prefix && original[original.length - suffix - 1].key === comparison[comparison.length - suffix - 1].key) suffix += 1;
  const segments = [];
  for (let index = 0; index < prefix; index += 1) mergeSegment(segments, 'same', original[index].text, original[index].units);
  for (let index = prefix; index < original.length - suffix; index += 1) mergeSegment(segments, 'removed', original[index].text, original[index].units);
  for (let index = prefix; index < comparison.length - suffix; index += 1) mergeSegment(segments, 'added', comparison[index].text, comparison[index].units);
  for (let index = comparison.length - suffix; index < comparison.length; index += 1) mergeSegment(segments, 'same', comparison[index].text, comparison[index].units);
  return segments;
}

function diffSequences(original, comparison) {
  const rows = original.length;
  const columns = comparison.length;
  if (!rows && !columns) return [];
  if (!rows) return [{ type: 'added', text: comparison.map(item => item.text).join(''), units: comparison.length }];
  if (!columns) return [{ type: 'removed', text: original.map(item => item.text).join(''), units: original.length }];
  if (rows * columns > DIFF_CELL_LIMIT) return coarseDiff(original, comparison);

  const table = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] = original[row].key === comparison[column].key
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  const segments = [];
  let row = 0;
  let column = 0;
  while (row < rows || column < columns) {
    if (row < rows && column < columns && original[row].key === comparison[column].key) {
      mergeSegment(segments, 'same', original[row].text, original[row].units);
      row += 1;
      column += 1;
    } else if (column < columns && (row === rows || table[row][column + 1] >= table[row + 1][column])) {
      mergeSegment(segments, 'added', comparison[column].text, comparison[column].units);
      column += 1;
    } else {
      mergeSegment(segments, 'removed', original[row].text, original[row].units);
      row += 1;
    }
  }
  return segments;
}

function compareTexts(originalText, comparisonText, mode, options) {
  const ignores = ignoreState(options);
  const original = buildTokens(originalText, mode, ignores);
  const comparison = buildTokens(comparisonText, mode, ignores);
  const segments = diffSequences(original, comparison);
  const stats = segments.reduce((summary, segment) => ({ ...summary, [segment.type]: summary[segment.type] + segment.units }), { added: 0, removed: 0, same: 0 });
  return { segments, stats };
}

function copyTextForDiff(segments) {
  return segments.map(segment => `${segment.type === 'added' ? '+ ' : (segment.type === 'removed' ? '- ' : '  ')}${segment.text}`).join('');
}

function wrapCanvasSegments(context, segments, width, font) {
  context.font = font;
  const lines = [];
  let line = [];
  let lineWidth = 0;
  const pushLine = () => { lines.push(line); line = []; lineWidth = 0; };
  segments.forEach(segment => {
    Array.from(segment.text).forEach(character => {
      if (character === '\r') return;
      if (character === '\n') return pushLine();
      const characterWidth = context.measureText(character).width;
      if (line.length && lineWidth + characterWidth > width) pushLine();
      line.push({ character, type: segment.type, width: characterWidth });
      lineWidth += characterWidth;
    });
  });
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

function drawCompareCanvas(canvas, segments, stats, mode, onlyDiffs) {
  const width = 750;
  const padding = 44;
  const bodyFont = '24px sans-serif';
  const context = canvas.getContext('2d');
  const lines = wrapCanvasSegments(context, segments, width - padding * 2, bodyFont);
  const visibleLines = lines.slice(0, 84);
  const lineHeight = 36;
  const headerHeight = 174;
  const footerHeight = 66;
  const height = headerHeight + Math.max(1, visibleLines.length) * lineHeight + footerHeight;
  const ratio = typeof wx.getSystemInfoSync === 'function' ? (wx.getSystemInfoSync().pixelRatio || 1) : 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.fillStyle = '#F7F9FC';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#15233B';
  context.font = '700 30px sans-serif';
  context.fillText('极团工具箱 · 文字比对', padding, 48);
  context.fillStyle = '#718096';
  context.font = '20px sans-serif';
  context.fillText(`${mode === 'line' ? '按行对比' : '按字对比'}${onlyDiffs ? ' · 仅显示差异' : ''}`, padding, 80);
  const pills = [
    { label: `新增 ${stats.added}`, color: '#2E8D66', background: '#EAF9F1' },
    { label: `删除 ${stats.removed}`, color: '#C55B5B', background: '#FFF0F0' },
    { label: `相同 ${stats.same}`, color: '#60758F', background: '#EEF3F8' }
  ];
  let pillX = padding;
  pills.forEach(pill => {
    context.font = '600 18px sans-serif';
    const pillWidth = context.measureText(pill.label).width + 24;
    context.fillStyle = pill.background;
    context.fillRect(pillX, 104, pillWidth, 32);
    context.fillStyle = pill.color;
    context.fillText(pill.label, pillX + 12, 126);
    pillX += pillWidth + 10;
  });
  context.fillStyle = '#FFFFFF';
  context.fillRect(padding, 150, width - padding * 2, height - 150 - footerHeight);
  context.font = bodyFont;
  visibleLines.forEach((line, lineIndex) => {
    let x = padding + 18;
    const y = 182 + lineIndex * lineHeight;
    line.forEach(item => {
      context.fillStyle = item.type === 'added' ? '#2E8D66' : (item.type === 'removed' ? '#C55B5B' : '#334A67');
      context.fillText(item.character, x, y);
      if (item.type === 'added') {
        context.fillStyle = '#D6F2E2';
        context.fillRect(x, y + 4, item.width, 3);
      } else if (item.type === 'removed') {
        context.fillStyle = '#F1B8B8';
        context.fillRect(x, y - 10, item.width, 2);
      }
      x += item.width;
    });
  });
  if (lines.length > visibleLines.length) {
    context.fillStyle = '#8A9AB0';
    context.font = '18px sans-serif';
    context.fillText('内容较长，仅展示前 84 行', padding + 18, 182 + visibleLines.length * lineHeight);
  }
  context.fillStyle = '#A0AEC0';
  context.font = '18px sans-serif';
  context.fillText('本图由极团工具箱在本地生成', padding, height - 24);
  return { width, height };
}

Page({
  data: {
    originalText: '',
    comparisonText: '',
    originalCount: 0,
    comparisonCount: 0,
    mode: 'line',
    modeOptions: MODE_OPTIONS,
    ignoreOptions: createIgnoreOptions(),
    segments: [],
    visibleSegments: [],
    onlyDiffs: false,
    hasCompared: false,
    exporting: false,
    stats: { added: 0, removed: 0, same: 0 }
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
    return getShareAppMessage({ path: '/pages/text-compare/text-compare' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || typeof record.text !== 'string') return;
    const mode = record.compareMode === 'char' ? 'char' : 'line';
    const ignoreOptions = createIgnoreOptions(Array.isArray(record.compareIgnores) ? record.compareIgnores : []);
    this.restoredHistoryRecordId = recordId;
    this.lastRecordedSignature = `${record.text}\u0000${record.compareText || ''}\u0000${mode}\u0000${ignoreOptions.filter(item => item.active).map(item => item.key).join(',')}`;
    this.updateComparison(record.text, String(record.compareText || ''), mode, ignoreOptions);
  },

  updateComparison(originalText, comparisonText, mode = this.data.mode, ignoreOptions = this.data.ignoreOptions) {
    const result = compareTexts(originalText, comparisonText, mode, ignoreOptions);
    const visibleSegments = this.data.onlyDiffs ? result.segments.filter(segment => segment.type !== 'same') : result.segments;
    this.setData({ originalText, comparisonText, originalCount: Array.from(originalText).length, comparisonCount: Array.from(comparisonText).length, mode, modeOptions: MODE_OPTIONS.map(item => ({ ...item, active: item.key === mode })), ignoreOptions, segments: result.segments, visibleSegments, stats: result.stats, hasCompared: Boolean(originalText || comparisonText) });
  },

  onTextInput(event) {
    const side = event.currentTarget.dataset.side;
    const value = event && event.detail ? String(event.detail.value || '') : '';
    const originalText = side === 'original' ? value : this.data.originalText;
    const comparisonText = side === 'comparison' ? value : this.data.comparisonText;
    this.updateComparison(originalText, comparisonText);
    const count = Array.from(value).length;
    if (count >= MAX_TEXT_LENGTH && !this.limitNotified) {
      this.limitNotified = true;
      wx.showToast({ title: '单个文本框最多输入 100000 字符', icon: 'none' });
    } else if (count < MAX_TEXT_LENGTH) {
      this.limitNotified = false;
    }
  },

  clearInput(event) {
    const side = event.currentTarget.dataset.side;
    if (side === 'original') this.updateComparison('', this.data.comparisonText);
    if (side === 'comparison') this.updateComparison(this.data.originalText, '');
  },

  swapTexts() {
    this.updateComparison(this.data.comparisonText, this.data.originalText);
    wx.showToast({ title: '已交换文本顺序', icon: 'none' });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'char' && mode !== 'line') return;
    this.updateComparison(this.data.originalText, this.data.comparisonText, mode);
  },

  toggleIgnore(event) {
    const key = event.currentTarget.dataset.key;
    const ignoreOptions = this.data.ignoreOptions.map(item => item.key === key ? { ...item, active: !item.active } : item);
    this.updateComparison(this.data.originalText, this.data.comparisonText, this.data.mode, ignoreOptions);
  },

  toggleOnlyDiffs() {
    const onlyDiffs = !this.data.onlyDiffs;
    this.setData({ onlyDiffs, visibleSegments: onlyDiffs ? this.data.segments.filter(segment => segment.type !== 'same') : this.data.segments });
  },

  copyResult() {
    if (!this.data.hasCompared) return wx.showToast({ title: '请先输入两段文字', icon: 'none' });
    const segments = this.data.onlyDiffs ? this.data.visibleSegments : this.data.segments;
    if (!segments.length) return wx.showToast({ title: '当前没有可复制的差异', icon: 'none' });
    wx.setClipboardData({ data: copyTextForDiff(segments), success: () => { track('result_copy', { tool: 'text-compare' }); wx.showToast({ title: '对比结果已复制' }); } });
  },

  exportCompareImage() {
    if (!this.data.hasCompared) return wx.showToast({ title: '请先输入两段文字', icon: 'none' });
    if (this.data.exporting) return;
    if (typeof wx.createSelectorQuery !== 'function' || typeof wx.canvasToTempFilePath !== 'function' || typeof wx.saveImageToPhotosAlbum !== 'function') return wx.showToast({ title: '当前微信版本暂不支持导出图片', icon: 'none' });
    this.setData({ exporting: true });
    const resultName = outputName('jituan-text-compare', 'png');
    const query = wx.createSelectorQuery();
    query.select('#compareCanvas').node().exec(result => {
      const canvas = result && result[0] && result[0].node;
      if (!canvas) {
        this.setData({ exporting: false });
        return wx.showToast({ title: '导出画布初始化失败', icon: 'none' });
      }
      const rendered = drawCompareCanvas(canvas, this.data.visibleSegments, this.data.stats, this.data.mode, this.data.onlyDiffs);
      wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width: rendered.width, height: rendered.height, destWidth: rendered.width, destHeight: rendered.height, fileType: 'png', success: file => {
        saveNamedImageToAlbum(file.tempFilePath, 'jituan-text-compare', 'png', resultName).then(() => { track('result_export', { tool: 'text-compare' }); wx.showToast({ title: '对比图已保存' }); }).catch(() => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false })).then(() => this.setData({ exporting: false }));
      }, fail: () => {
        this.setData({ exporting: false });
        wx.showToast({ title: '对比图生成失败，请重试', icon: 'none' });
      } });
    });
  },

  clearAll() {
    if (!this.data.originalText && !this.data.comparisonText) return wx.showToast({ title: '当前没有可清空的文字', icon: 'none' });
    this.limitNotified = false;
    this.setData({ originalText: '', comparisonText: '', originalCount: 0, comparisonCount: 0, segments: [], visibleSegments: [], hasCompared: false, stats: { added: 0, removed: 0, same: 0 } });
    wx.showToast({ title: '已清空文字', icon: 'none' });
  },

  saveRecord() {
    if (!this.data.originalText && !this.data.comparisonText) return wx.showToast({ title: '请先输入对比文字', icon: 'none' });
    const ignoreKeys = this.data.ignoreOptions.filter(item => item.active).map(item => item.key);
    const signature = `${this.data.originalText}\u0000${this.data.comparisonText}\u0000${this.data.mode}\u0000${ignoreKeys.join(',')}`;
    if (this.lastRecordedSignature === signature) return wx.showToast({ title: '当前内容已保存', icon: 'none' });
    this.lastRecordedSignature = signature;
    app.recordRecent(TEXT_COMPARE_TOOL);
    app.recordOperation({
      ...TEXT_COMPARE_TOOL,
      modeLabel: this.data.mode === 'line' ? '按行对比' : '按字对比',
      detailText: `新增 ${this.data.stats.added} · 删除 ${this.data.stats.removed}`,
      text: this.data.originalText,
      compareText: this.data.comparisonText,
      compareMode: this.data.mode,
      compareIgnores: ignoreKeys
    }).then(() => wx.showToast({ title: '已保存到操作记录' })).catch(() => {
      this.lastRecordedSignature = '';
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});
