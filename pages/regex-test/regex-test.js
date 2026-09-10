const app = getApp();
const { MAX_PATTERN, MAX_TEXT, runRegex } = require('../../utils/regex-test');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'regex-test', title: '正则表达式测试', desc: '实时验证表达式并查看匹配结果', icon: 'regex-test', tone: 'orange', page: '/pages/regex-test/regex-test' };
const FLAG_OPTIONS = [
  { key: 'g', title: '全局', desc: '查找全部匹配' }, { key: 'i', title: '忽略大小写', desc: 'A 与 a 视为相同' },
  { key: 'm', title: '多行', desc: '^ 和 $ 按行匹配' }, { key: 's', title: '跨行点号', desc: '. 可以匹配换行' },
  { key: 'u', title: 'Unicode', desc: '按完整字符处理' }
];
const flagViews = flags => FLAG_OPTIONS.map(item => ({ ...item, active: flags.includes(item.key) }));

Page({
  data: { pattern: '', testText: '', patternCount: 0, textCount: 0, maxPattern: MAX_PATTERN, maxText: MAX_TEXT, flagOptions: flagViews(['g']), flags: ['g'], flagsText: 'g', matches: [], segments: [], hasTested: false, truncated: false, error: '', saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key) return;
    const pattern = String(record.regexPattern || ''); const testText = String(record.regexText || ''); const flags = Array.isArray(record.regexFlags) ? record.regexFlags : ['g'];
    this.setData({ pattern, testText, patternCount: pattern.length, textCount: testText.length, flags, flagsText: flags.join(''), flagOptions: flagViews(flags) }, () => { this.test(); this.setData({ saved: true }); });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  onPattern(event) { const pattern = String(event.detail.value || ''); this.setData({ pattern, patternCount: pattern.length, hasTested: false, matches: [], segments: [], error: '', saved: false }); },
  onText(event) { const testText = String(event.detail.value || ''); this.setData({ testText, textCount: testText.length, hasTested: false, matches: [], segments: [], error: '', saved: false }); },
  toggleFlag(event) { const key = event.currentTarget.dataset.key; const flags = this.data.flags.includes(key) ? this.data.flags.filter(item => item !== key) : this.data.flags.concat(key); this.setData({ flags, flagsText: flags.join(''), flagOptions: flagViews(flags), hasTested: false, matches: [], segments: [], error: '', saved: false }); },
  test() {
    if (!this.data.pattern) return wx.showToast({ title: '请先输入正则表达式', icon: 'none' });
    if (!this.data.testText) return wx.showToast({ title: '请先输入待测试文本', icon: 'none' });
    try {
      const result = runRegex(this.data.pattern, this.data.flags, this.data.testText);
      const matches = result.matches.map((item, index) => ({ ...item, order: index + 1, display: item.value || '空匹配', range: item.end > item.index ? `${item.index}–${item.end - 1}` : `${item.index}` }));
      this.setData({ matches, segments: result.segments.map((item, index) => ({ ...item, id: index })), hasTested: true, truncated: result.truncated, error: '', saved: false });
      app.recordRecent(TOOL);
    } catch (error) { this.setData({ matches: [], segments: [], hasTested: false, truncated: false, error: error.message || '表达式无法执行', saved: false }); }
  },
  copyMatches() { if (!this.data.matches.length) return wx.showToast({ title: '当前没有匹配结果', icon: 'none' }); const text = this.data.matches.map(item => item.value).join('\n'); wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '匹配结果已复制' }) }); },
  clear() { this.setData({ pattern: '', testText: '', patternCount: 0, textCount: 0, flags: ['g'], flagsText: 'g', flagOptions: flagViews(['g']), matches: [], segments: [], hasTested: false, truncated: false, error: '', saved: false }); },
  async saveRecord() {
    if (!this.data.hasTested || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次结果已保存' : '请先完成测试', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...TOOL, regexPattern: this.data.pattern, regexText: this.data.testText, regexFlags: this.data.flags, modeLabel: `/${this.data.pattern}/${this.data.flags.join('')}`, detailText: `匹配 ${this.data.matches.length} 处`, text: this.data.matches.map(item => item.value).join('\n') });
      this.setData({ saving: false, saved: true }); wx.showToast({ title: '已保存到操作记录' });
    } catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
