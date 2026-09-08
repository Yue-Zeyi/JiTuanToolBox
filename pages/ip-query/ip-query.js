const { analyzeAddress } = require('../../utils/ip-address');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const runtime = require('../../config/runtime');

Page({
  data: { mode: 'current', input: '', loading: false, addresses: [], missingVersions: [], analysis: null, error: '', checkedTime: '' },
  onLoad() { this._revision = 0; this._unloaded = false; },
  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!['current', 'analyze'].includes(mode)) return;
    this._revision++;
    this.setData({ mode, loading: false, error: '' });
  },
  onInput(event) { this.setData({ input: event.detail.value, analysis: null, error: '' }); },
  async queryCurrent() {
    if (this.data.loading) return;
    const revision = ++this._revision;
    this.setData({ loading: true, addresses: [], missingVersions: [], checkedTime: '', error: '' });
    let timer;
    try {
      if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') throw new Error('当前微信版本暂不支持查询，请更新后重试');
      const result = await Promise.race([
        wx.cloud.callFunction({ name: 'network-info', data: {}, config: { env: runtime.cloudEnvId } }),
        new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('查询超时，请检查网络后重试')), 15000); })
      ]);
      if (this._unloaded || revision !== this._revision) return;
      const payload = result && result.result;
      if (!payload || !payload.ok) throw new Error(payload && payload.code === 'ADDRESS_UNAVAILABLE' ? '微信暂未提供连接地址，请在手机端重试' : '查询暂不可用，请稍后重试');
      if (!Array.isArray(payload.addresses) || !payload.addresses.length) throw new Error('未获取到有效连接地址，请重试');
      const addresses = payload.addresses.map(item => analyzeAddress(item.ip));
      const missingVersions = ['IPv4', 'IPv6'].filter(version => !addresses.some(item => item.version === version));
      this.setData({ addresses, missingVersions, checkedTime: new Date().toLocaleTimeString() });
    } catch (error) {
      if (!this._unloaded && revision === this._revision) this.setData({ error: error.message && !/cloud|function|request|network/i.test(error.message) ? error.message : '网络查询失败，请稍后重试' });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (!this._unloaded && revision === this._revision) this.setData({ loading: false });
    }
  },
  analyze() {
    try { this.setData({ analysis: analyzeAddress(this.data.input), error: '' }); }
    catch (error) { this.setData({ analysis: null, error: error.message }); }
  },
  paste() {
    wx.getClipboardData({ success: result => this.onInput({ detail: { value: result.data.slice(0, 100) } }), fail: () => wx.showToast({ title: '无法读取剪贴板', icon: 'none' }) });
  },
  clear() { this.setData({ input: '', analysis: null, error: '' }); },
  copyAddress(event) {
    const item = this.data.addresses[Number(event.currentTarget.dataset.index)];
    if (item) this.copy(item.normalized);
  },
  copyAnalysis() {
    const item = this.data.analysis;
    if (item) this.copy(`${item.version}：${item.normalized}\n地址类型：${item.rangeLabel}\n完整地址：${item.expanded}\n网络字节序：${item.hex}${item.mappedIPv4 ? `\n映射 IPv4：${item.mappedIPv4}（${item.mappedRangeLabel}）` : ''}`);
  },
  copy(data) { wx.setClipboardData({ data, success: () => wx.showToast({ title: '已复制' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) }); },
  onHide() { this._revision++; if (this.data.loading) this.setData({ loading: false }); },
  onUnload() { this._unloaded = true; this._revision++; },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/ip-query/ip-query' }); },
  onShareTimeline() { return getShareTimeline(); }
});
