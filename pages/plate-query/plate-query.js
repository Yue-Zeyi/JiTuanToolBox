const app = getApp();
const { analyzePlate, normalizePlate } = require('../../utils/plate-query');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'plate-query', title: '车牌号查询', desc: '校验号牌格式与省级归属信息', icon: 'plate-query', tone: 'blue', page: '/pages/plate-query/plate-query' };
const EXAMPLES = [{ plate: '京A12345', label: '普通号牌' }, { plate: '粤BD12345', label: '新能源小型' }, { plate: '沪A12345D', label: '新能源大型' }, { plate: '浙A1234学', label: '教练号牌' }];

Page({
  data: { input: '', inputPrefix: '省A', examples: EXAMPLES, result: null, error: '', saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key || !record.plateInput) return;
    this.setData({ input: record.plateInput, inputPrefix: String(record.plateInput).slice(0, 2) }, () => { this.query(); this.setData({ saved: true }); });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  onInput(event) { const input = normalizePlate(event.detail.value).slice(0, 8); this.setData({ input, inputPrefix: input.slice(0, 2) || '省A', result: null, error: '', saved: false }); },
  chooseExample(event) { const item = EXAMPLES[Number(event.currentTarget.dataset.index)]; if (item) this.setData({ input: item.plate, inputPrefix: item.plate.slice(0, 2), result: null, error: '', saved: false }); },
  query() {
    const result = analyzePlate(this.data.input);
    if (!result.valid) return this.setData({ result: null, error: result.reason, saved: false });
    this.setData({ input: result.plate, inputPrefix: result.prefix, result, error: '', saved: false });
    app.recordRecent(TOOL);
  },
  clear() { this.setData({ input: '', inputPrefix: '省A', result: null, error: '', saved: false }); },
  copyPlate() { if (this.data.result) wx.setClipboardData({ data: this.data.result.plate, success: () => wx.showToast({ title: '车牌号已复制' }) }); },
  async saveRecord() {
    if (!this.data.result || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次结果已保存' : '请先完成查询', icon: 'none' });
    const result = this.data.result;
    this.setData({ saving: true });
    try { await app.recordOperation({ ...TOOL, plateInput: result.plate, modeLabel: result.typeLabel, detailText: `${result.provinceName} · ${result.agencyCode} 号发牌机关`, text: `${result.plate}\n${result.typeLabel}\n${result.provinceName}\n发牌机关代码：${result.agencyCode}${result.energy ? `\n能源类型：${result.energy}` : ''}` }); this.setData({ saving: false, saved: true }); wx.showToast({ title: '已保存到操作记录' }); }
    catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
