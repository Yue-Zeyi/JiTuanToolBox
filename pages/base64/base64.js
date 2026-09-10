const app = getApp();
const { MAX_INPUT, decodeBase64, encodeBase64 } = require('../../utils/base64');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'base64', title: 'Base64 编解码', desc: '文字与 Base64 内容双向转换', icon: 'base64', tone: 'purple', page: '/pages/base64/base64' };

Page({
  data: { mode: 'encode', input: '', output: '', inputCount: 0, outputCount: 0, maxLength: MAX_INPUT, error: '', saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key) return;
    const input = String(record.codecInput || '');
    const output = String(record.codecOutput || '');
    this.setData({ mode: record.codecMode === 'decode' ? 'decode' : 'encode', input, output, inputCount: input.length, outputCount: output.length, saved: true });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  selectMode(event) { const mode = event.currentTarget.dataset.mode; if (mode !== this.data.mode) this.setData({ mode, output: '', outputCount: 0, error: '', saved: false }); },
  onInput(event) { const input = String(event.detail.value || ''); this.setData({ input, inputCount: input.length, output: '', outputCount: 0, error: '', saved: false }); },
  convert() {
    if (!this.data.input) return wx.showToast({ title: this.data.mode === 'encode' ? '请先输入需要编码的文字' : '请先输入 Base64 内容', icon: 'none' });
    try {
      const output = this.data.mode === 'encode' ? encodeBase64(this.data.input) : decodeBase64(this.data.input);
      this.setData({ output, outputCount: output.length, error: '', saved: false });
      app.recordRecent(TOOL);
    } catch (error) { this.setData({ output: '', outputCount: 0, error: error.message || '转换失败，请检查输入内容', saved: false }); }
  },
  copyResult() { if (!this.data.output) return wx.showToast({ title: '当前没有可复制的结果', icon: 'none' }); wx.setClipboardData({ data: this.data.output, success: () => wx.showToast({ title: '结果已复制' }) }); },
  useAsInput() { if (!this.data.output) return; const input = this.data.output; this.setData({ mode: this.data.mode === 'encode' ? 'decode' : 'encode', input, inputCount: input.length, output: '', outputCount: 0, error: '', saved: false }); },
  clear() { this.setData({ input: '', output: '', inputCount: 0, outputCount: 0, error: '', saved: false }); },
  async saveRecord() {
    if (!this.data.output || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次结果已保存' : '请先完成转换', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...TOOL, codecMode: this.data.mode, codecInput: this.data.input, codecOutput: this.data.output, modeLabel: this.data.mode === 'encode' ? '文字转 Base64' : 'Base64 转文字', detailText: `${this.data.inputCount} → ${this.data.outputCount} 个字符`, text: this.data.output });
      this.setData({ saving: false, saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
