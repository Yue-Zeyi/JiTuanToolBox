const app = getApp();
const { MAX_INPUT, decodeUrl, encodeUrl } = require('../../utils/url-codec');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'url-codec', title: 'URL 编解码', desc: '网址与参数安全编码解码', icon: 'url-codec', tone: 'orange', page: '/pages/url-codec/url-codec' };

Page({
  data: { action: 'encode', scope: 'component', plusAsSpace: true, input: '', output: '', inputCount: 0, outputCount: 0, maxLength: MAX_INPUT, error: '', saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key) return;
    const input = String(record.codecInput || '');
    const output = String(record.codecOutput || '');
    this.setData({ action: record.codecAction === 'decode' ? 'decode' : 'encode', scope: record.codecScope === 'url' ? 'url' : 'component', plusAsSpace: record.plusAsSpace !== false, input, output, inputCount: input.length, outputCount: output.length, saved: true });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  selectAction(event) { const action = event.currentTarget.dataset.action; if (action !== this.data.action) this.setData({ action, output: '', outputCount: 0, error: '', saved: false }); },
  selectScope(event) { this.setData({ scope: event.currentTarget.dataset.scope, output: '', outputCount: 0, error: '', saved: false }); },
  togglePlus(event) { this.setData({ plusAsSpace: Boolean(event.detail.value), output: '', outputCount: 0, error: '', saved: false }); },
  onInput(event) { const input = String(event.detail.value || ''); this.setData({ input, inputCount: input.length, output: '', outputCount: 0, error: '', saved: false }); },
  convert() {
    if (!this.data.input) return wx.showToast({ title: this.data.action === 'encode' ? '请先输入网址或参数' : '请先输入编码内容', icon: 'none' });
    try {
      const output = this.data.action === 'encode' ? encodeUrl(this.data.input, this.data.scope) : decodeUrl(this.data.input, this.data.scope, this.data.plusAsSpace);
      this.setData({ output, outputCount: output.length, error: '', saved: false });
      app.recordRecent(TOOL);
    } catch (error) { this.setData({ output: '', outputCount: 0, error: error.message || '转换失败，请检查输入', saved: false }); }
  },
  copyResult() { if (!this.data.output) return wx.showToast({ title: '当前没有可复制的结果', icon: 'none' }); wx.setClipboardData({ data: this.data.output, success: () => wx.showToast({ title: '结果已复制' }) }); },
  reverse() { if (!this.data.output) return; const input = this.data.output; this.setData({ action: this.data.action === 'encode' ? 'decode' : 'encode', input, inputCount: input.length, output: '', outputCount: 0, error: '', saved: false }); },
  clear() { this.setData({ input: '', output: '', inputCount: 0, outputCount: 0, error: '', saved: false }); },
  async saveRecord() {
    if (!this.data.output || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次结果已保存' : '请先完成转换', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...TOOL, codecAction: this.data.action, codecScope: this.data.scope, plusAsSpace: this.data.plusAsSpace, codecInput: this.data.input, codecOutput: this.data.output, modeLabel: `${this.data.scope === 'url' ? '完整网址' : '参数值'}${this.data.action === 'encode' ? '编码' : '解码'}`, detailText: `${this.data.inputCount} → ${this.data.outputCount} 个字符`, text: this.data.output });
      this.setData({ saving: false, saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
