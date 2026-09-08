const app = getApp();
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MAX_TEXT_LENGTH = 100000;
const FANCY_FONT_TOOL = { key: 'fancy-font', title: '花样字体', desc: '一键生成个性化文字样式', icon: 'fancy-font', tone: 'purple', page: '/pages/fancy-font/fancy-font' };
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function createMap(source, target) {
  const sourceCharacters = Array.from(source);
  const targetCharacters = Array.from(target);
  return sourceCharacters.reduce((map, character, index) => {
    if (targetCharacters[index]) map[character] = targetCharacters[index];
    return map;
  }, {});
}

function createFullwidthMap() {
  const map = { ' ': '　' };
  for (let codePoint = 0x21; codePoint <= 0x7E; codePoint += 1) {
    map[String.fromCodePoint(codePoint)] = String.fromCodePoint(codePoint + 0xFEE0);
  }
  return map;
}

function createSuperscriptMap() {
  const map = createMap('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹');
  const pairs = {
    A: 'ᴬ', B: 'ᴮ', C: 'ᶜ', D: 'ᴰ', E: 'ᴱ', F: 'ᶠ', G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ',
    N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', Q: 'ᑫ', R: 'ᴿ', S: 'ˢ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ', W: 'ᵂ', X: 'ˣ', Y: 'ʸ', Z: 'ᶻ',
    a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ',
    n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: 'ᑫ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ'
  };
  return { ...map, ...pairs };
}

const STYLE_MAPS = {
  normal: {},
  bold: {
    ...createMap(UPPERCASE, '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭'),
    ...createMap(LOWERCASE, '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇'),
    ...createMap(DIGITS, '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵')
  },
  italic: {
    ...createMap(UPPERCASE, '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡'),
    ...createMap(LOWERCASE, '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻')
  },
  'bold-italic': {
    ...createMap(UPPERCASE, '𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁'),
    ...createMap(LOWERCASE, '𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛')
  },
  monospace: {
    ...createMap(UPPERCASE, '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉'),
    ...createMap(LOWERCASE, '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣'),
    ...createMap(DIGITS, '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿')
  },
  fraktur: {
    ...createMap(UPPERCASE, '𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ'),
    ...createMap(LOWERCASE, '𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷')
  },
  circled: {
    ...createMap(UPPERCASE, 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ'),
    ...createMap(LOWERCASE, 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ'),
    ...createMap(DIGITS, '⓪①②③④⑤⑥⑦⑧⑨')
  },
  fullwidth: createFullwidthMap(),
  superscript: createSuperscriptMap()
};

const FONT_STYLES = [
  { key: 'bold', title: '粗体', desc: '醒目强调', sample: 'Emphasis 123' },
  { key: 'italic', title: '斜体', desc: '轻盈倾斜', sample: 'Elegant 123' },
  { key: 'bold-italic', title: '粗斜体', desc: '更强强调', sample: 'Style 123' },
  { key: 'monospace', title: '等宽', desc: '代码感更强', sample: 'Width 123' },
  { key: 'fraktur', title: '哥特体', desc: '复古艺术感', sample: 'Fancy 123' },
  { key: 'circled', title: '带圈', desc: '昵称更醒目', sample: 'Style 123' },
  { key: 'fullwidth', title: '全角字', desc: '日系排版感', sample: 'Fancy 123' },
  { key: 'superscript', title: '上标', desc: '轻量小巧装饰', sample: 'Style 123' },
  { key: 'normal', title: '原文', desc: '保持原样', sample: 'Jituan 123' }
];

function transformText(value, styleKey) {
  const map = STYLE_MAPS[styleKey] || STYLE_MAPS.normal;
  return Array.from(String(value || '')).map(character => map[character] || character).join('');
}

function sanitizeFancyText(value) {
  const characters = Array.from(String(value || ''));
  const text = characters.filter(character => /[A-Za-z0-9\x20-\x7E\r\n\t]/.test(character)).join('');
  return { text, removed: characters.length - Array.from(text).length };
}

function getStyleOptions(selectedKey) {
  return FONT_STYLES.map(item => ({ ...item, active: item.key === selectedKey, preview: transformText(item.sample, item.key) }));
}

function getStats(input, output) {
  return { inputCharacters: Array.from(input).length, outputCharacters: Array.from(output).length };
}

Page({
  data: {
    text: '',
    resultText: '',
    hasResult: false,
    selectedStyle: 'bold',
    selectedStyleTitle: '粗体',
    styles: getStyleOptions('bold'),
    stats: getStats('', '')
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
    return getShareAppMessage({ path: '/pages/fancy-font/fancy-font' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || typeof record.text !== 'string') return;
    const selectedStyle = FONT_STYLES.some(item => item.key === record.fontStyle) ? record.fontStyle : 'bold';
    const text = sanitizeFancyText(record.text).text;
    const resultText = transformText(text, selectedStyle);
    const style = FONT_STYLES.find(item => item.key === selectedStyle) || FONT_STYLES[0];
    this.restoredHistoryRecordId = recordId;
    this.lastRecordedSignature = `${text}\u0000${selectedStyle}`;
    this.setData({ text, resultText, hasResult: Boolean(text), selectedStyle, selectedStyleTitle: style.title, styles: getStyleOptions(selectedStyle), stats: getStats(text, resultText) });
  },

  updateResult(text, selectedStyle = this.data.selectedStyle) {
    const resultText = transformText(text, selectedStyle);
    const style = FONT_STYLES.find(item => item.key === selectedStyle) || FONT_STYLES[0];
    this.setData({ text, resultText, hasResult: Boolean(text), selectedStyle, selectedStyleTitle: style.title, styles: getStyleOptions(selectedStyle), stats: getStats(text, resultText) });
  },

  onTextInput(event) {
    const rawText = event && event.detail ? String(event.detail.value || '') : '';
    const normalized = sanitizeFancyText(rawText);
    const text = normalized.text;
    this.updateResult(text);
    if (normalized.removed && !this.unsupportedNotice) {
      this.unsupportedNotice = true;
      wx.showToast({ title: '仅支持英文、数字和常用符号', icon: 'none' });
    } else if (!normalized.removed) {
      this.unsupportedNotice = false;
    }
    const count = Array.from(text).length;
    if (count >= MAX_TEXT_LENGTH && !this.limitNotified) {
      this.limitNotified = true;
      wx.showToast({ title: '已达到最大输入长度', icon: 'none' });
    } else if (count < MAX_TEXT_LENGTH) {
      this.limitNotified = false;
    }
  },

  selectStyle(event) {
    const selectedStyle = event.currentTarget.dataset.style;
    if (!STYLE_MAPS[selectedStyle]) return;
    this.updateResult(this.data.text, selectedStyle);
    track('font_style_select', { tool: 'fancy-font', style: selectedStyle });
  },

  copyResult() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (!this.data.resultText) return wx.showToast({ title: '当前没有可复制内容', icon: 'none' });
    wx.setClipboardData({ data: this.data.resultText, success: () => { track('result_copy', { tool: 'fancy-font' }); wx.showToast({ title: '结果已复制' }); } });
  },

  replaceOriginal() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    if (this.data.resultText === this.data.text) return wx.showToast({ title: '当前样式不会改变文字', icon: 'none' });
    this.limitNotified = false;
    this.updateResult(this.data.resultText, this.data.selectedStyle);
    wx.showToast({ title: '已替换原文', icon: 'none' });
  },

  clearText() {
    if (!this.data.text) return wx.showToast({ title: '当前没有可清空的文字', icon: 'none' });
    this.limitNotified = false;
    this.unsupportedNotice = false;
    this.setData({ text: '', resultText: '', hasResult: false, stats: getStats('', '') });
    wx.showToast({ title: '已清空文字', icon: 'none' });
  },

  saveRecord() {
    const text = this.data.text;
    if (!text) return wx.showToast({ title: '请先输入文字', icon: 'none' });
    const signature = `${text}\u0000${this.data.selectedStyle}`;
    if (this.lastRecordedSignature === signature) return wx.showToast({ title: '当前内容已保存', icon: 'none' });
    this.lastRecordedSignature = signature;
    app.recordRecent(FANCY_FONT_TOOL);
    app.recordOperation({
      ...FANCY_FONT_TOOL,
      modeLabel: this.data.selectedStyleTitle,
      detailText: `${this.data.stats.inputCharacters} 字符 · 已生成样式`,
      text,
      fancyText: this.data.resultText,
      fontStyle: this.data.selectedStyle
    }).then(() => wx.showToast({ title: '已保存到操作记录' })).catch(() => {
      this.lastRecordedSignature = '';
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});
