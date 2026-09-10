const app = getApp();
const { parseJson, formatJson, getTreeRows, MAX_INPUT } = require('../../utils/json-format');
const { getTool } = require('../../utils/tool-catalog');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
Page({
  data: {
    text: '', count: 0, indent: 2, indents: [2, 4], mode: 'format', view: 'text', allowComments: true, comments: 0,
    hasResult: false, preview: '', truncated: false, outputCount: 0, nodeCount: 0,
    duplicates: 0, error: '', errorLine: 0, errorColumn: 0, errorIndex: 0,
    rows: [], more: false, treeOffset: 0, treeScrollTop: 0, saving: false, editorFocus: false, selectionStart: -1, selectionEnd: -1
  },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(options.recordId);
    if (!record || record.key !== 'json-format' || typeof record.text !== 'string') return;
    this.setData({ text: record.text, count: record.text.length, indent: record.jsonIndent === 4 ? 4 : 2, mode: record.jsonMode === 'minify' ? 'minify' : 'format', allowComments: record.jsonAllowComments === true });
    this.process(this.data.mode);
    if (this.data.hasResult) this.savedSignature = this.signature();
  },
  onShow() { const bar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (bar) bar.setData({ visible: false }); },
  invalidate(text) {
    this.parsed = null; this.output = ''; this.expanded = new Set();
    this.setData({ text, count: text.length, hasResult: false, preview: '', rows: [], more: false, comments: 0, error: '', errorLine: 0, editorFocus: false, selectionStart: -1, selectionEnd: -1 });
  },
  onInput(event) { this.invalidate(event.detail.value); },
  toggleComments(event) { this.setData({ allowComments: Boolean(event.detail.value) }); this.invalidate(this.data.text); },
  paste() {
    wx.getClipboardData({ success: result => {
      if (result.data.length > MAX_INPUT) return wx.showToast({ title: '最多支持 100000 字符，未替换当前内容', icon: 'none' });
      this.invalidate(result.data);
    }, fail: () => wx.showToast({ title: '未能读取剪贴板，请长按输入框粘贴', icon: 'none' }) });
  },
  selectIndent(event) {
    const indent = Number(event.currentTarget.dataset.indent);
    if (![2, 4].includes(indent)) return;
    this.setData({ indent });
    if (this.data.hasResult && this.data.mode === 'format') this.process('format');
  },
  format() { this.process('format'); },
  minify() { this.process('minify'); },
  process(mode) {
    try {
      const parsed = parseJson(this.data.text, { allowComments: this.data.allowComments });
      const output = formatJson(parsed.root, mode === 'minify' ? 0 : this.data.indent);
      this.parsed = parsed; this.output = output; this.expanded = new Set([parsed.root.id]);
      this.setData({ mode, hasResult: true, preview: output.slice(0, 12000), truncated: output.length > 12000, outputCount: output.length, nodeCount: parsed.nodeCount, duplicates: parsed.duplicates, comments: parsed.comments, error: '', errorLine: 0, treeOffset: 0 });
      this.refreshTree();
    } catch (error) {
      this.invalidate(this.data.text);
      this.setData({ error: error.message, errorLine: error.line || 0, errorColumn: error.column || 0, errorIndex: error.index || 0 });
      wx.showToast({ title: error.line ? 'JSON 格式有误，请查看下方定位' : error.message, icon: 'none' });
    }
  },
  locateError() { this.setData({ editorFocus: true, selectionStart: this.data.errorIndex, selectionEnd: Math.min(this.data.text.length, this.data.errorIndex + 1) }); },
  onBlur() { this.setData({ editorFocus: false }); },
  selectView(event) { const view = event.currentTarget.dataset.view; if (['text', 'tree'].includes(view)) this.setData({ view }); },
  refreshTree() {
    if (!this.parsed) return;
    const tree = getTreeRows(this.parsed.root, this.expanded, 200, this.data.treeOffset);
    this.setData({ rows: tree.rows, more: tree.more });
  },
  toggleNode(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!this.data.rows.some(row => row.id === id && row.branch)) return;
    if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id);
    this.refreshTree();
  },
  expandAll() {
    if (!this.parsed) return;
    this.expanded = new Set();
    const stack = [this.parsed.root];
    while (stack.length) { const node = stack.pop(); if (node.children) { this.expanded.add(node.id); node.children.forEach(child => stack.push(child)); } }
    this.setData({ treeOffset: 0 }); this.refreshTree();
  },
  collapseAll() { this.expanded = new Set(); this.setData({ treeOffset: 0 }); this.refreshTree(); },
  nextRows() { if (this.data.more) this.changeTreePage(this.data.treeOffset + 200); },
  previousRows() { this.changeTreePage(Math.max(0, this.data.treeOffset - 200)); },
  changeTreePage(treeOffset) { this.setData({ treeOffset, treeScrollTop: 1 }, () => this.setData({ treeScrollTop: 0 })); this.refreshTree(); },
  copyResult() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先格式化或压缩 JSON', icon: 'none' });
    wx.setClipboardData({ data: this.output, fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) });
  },
  copyNode(event) {
    if (!this.parsed || !this.data.hasResult) return;
    const id = Number(event.currentTarget.dataset.id);
    const stack = [this.parsed.root];
    let node;
    while (stack.length) {
      const current = stack.pop();
      if (current.id === id) { node = current; break; }
      if (current.children) current.children.forEach(child => stack.push(child));
    }
    if (!node) return;
    const hasKey = typeof node.key === 'string';
    const indent = this.data.mode === 'minify' ? 0 : this.data.indent;
    wx.showActionSheet({
      itemList: hasKey ? ['复制值', '复制键值对'] : ['复制值'],
      success: result => {
        const pair = result.tapIndex === 1 && hasKey;
        if (result.tapIndex !== 0 && !pair) return;
        try {
          // Read the full token tree, never the truncated row preview or JS numbers.
          const value = !pair && node.type === 'string' ? JSON.parse(node.raw) : formatJson(node, indent);
          const data = pair ? node.key + (indent ? ': ' : ':') + value : value;
          wx.setClipboardData({
            data,
            success: () => wx.showToast({ title: pair ? '键值对已复制' : '值已复制', icon: 'none' }),
            fail: () => wx.showToast({ title: data === '' ? '该值为空字符串，系统未能写入剪贴板' : '复制失败，请重试', icon: 'none' })
          });
        } catch (error) { wx.showToast({ title: error.message || '复制失败，请重试', icon: 'none' }); }
      }
    });
  },
  clear() { this.invalidate(''); this.savedSignature = ''; },
  signature() { return this.data.mode + ':' + this.data.indent + ':' + this.data.allowComments + ':' + this.data.text; },
  async saveRecord() {
    if (!this.data.hasResult) return wx.showToast({ title: '请先格式化或压缩 JSON', icon: 'none' });
    if (this.data.saving) return;
    const signature = this.signature();
    if (this.savedSignature === signature) return wx.showToast({ title: '当前内容已保存', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...getTool('json-format'), text: this.data.text, jsonMode: this.data.mode, jsonIndent: this.data.indent, jsonAllowComments: this.data.allowComments, modeLabel: this.data.mode === 'minify' ? '压缩 JSON' : this.data.indent + ' 空格缩进', detailText: this.data.count + ' → ' + this.data.outputCount + ' 字符' });
      this.savedSignature = signature;
      wx.showToast({ title: '已保存到操作记录', icon: 'none' });
    } catch (error) { wx.showToast({ title: '保存失败，请检查本机存储空间', icon: 'none' }); }
    finally { this.setData({ saving: false }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/json-format/json-format' }); },
  onShareTimeline() { return getShareTimeline(); }
});
