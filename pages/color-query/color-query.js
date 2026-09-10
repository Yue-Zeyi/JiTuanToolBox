const app = getApp();
const { colorDetails, hexToRgb, hslToRgb } = require('../../utils/color');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'color-query', title: '颜色查询表', desc: '颜色数值互查，浏览常用色表', icon: 'color-query', tone: 'orange', page: '/pages/color-query/color-query' };
const COLORS = [
  ['中国红', 'China Red', '#E60012'], ['朱红', 'Vermilion', '#FF4C35'], ['珊瑚红', 'Coral', '#FF6F61'], ['橙色', 'Orange', '#F59E0B'],
  ['琥珀', 'Amber', '#FFC107'], ['明黄', 'Yellow', '#FFD400'], ['草绿', 'Grass', '#52C41A'], ['翡翠绿', 'Emerald', '#10B981'],
  ['青色', 'Cyan', '#06B6D4'], ['湖蓝', 'Lake Blue', '#2F80ED'], ['天蓝', 'Sky Blue', '#38BDF8'], ['靛蓝', 'Indigo', '#4F46E5'],
  ['紫色', 'Purple', '#8B5CF6'], ['品红', 'Magenta', '#D946EF'], ['玫红', 'Rose', '#F43F5E'], ['粉色', 'Pink', '#EC4899'],
  ['米白', 'Ivory', '#FFFFF0'], ['浅灰', 'Light Gray', '#E5E7EB'], ['银灰', 'Silver', '#9CA3AF'], ['石墨', 'Graphite', '#4B5563'],
  ['深蓝', 'Navy', '#15233B'], ['黑色', 'Black', '#000000'], ['白色', 'White', '#FFFFFF'], ['咖啡', 'Coffee', '#795548']
].map((item, index) => ({ id: index, name: item[0], english: item[1], hex: item[2] }));

function buildResult(red, green, blue) { return colorDetails(red, green, blue); }
function validByte(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= 255; }
function validPercent(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= 100; }

Page({
  data: { mode: 'hex', hexInput: '#2F80ED', red: '47', green: '128', blue: '237', hue: '212', saturation: '84', lightness: '56', result: buildResult(47, 128, 237), colors: COLORS, query: '', saving: false, saved: false, error: '' },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key || !record.colorValue) return;
    try { const rgb = hexToRgb(record.colorValue); this.applyColor(buildResult(rgb.r, rgb.g, rgb.b), true); } catch (_) {}
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  selectMode(event) { this.setData({ mode: event.currentTarget.dataset.mode, error: '' }); },
  onHex(event) { this.setData({ hexInput: event.detail.value, error: '', saved: false }); },
  onChannel(event) { this.setData({ [event.currentTarget.dataset.key]: event.detail.value, error: '', saved: false }); },
  queryColor(event) {
    const query = String(event.detail.value || '').trim();
    const lower = query.toLowerCase();
    const colors = lower ? COLORS.filter(item => `${item.name} ${item.english} ${item.hex}`.toLowerCase().includes(lower)) : COLORS;
    this.setData({ query, colors });
  },
  choosePreset(event) {
    const item = COLORS.find(color => color.id === Number(event.currentTarget.dataset.id));
    if (!item) return;
    const rgb = hexToRgb(item.hex);
    this.applyColor(buildResult(rgb.r, rgb.g, rgb.b));
  },
  convert() {
    try {
      let rgb;
      if (this.data.mode === 'hex') rgb = hexToRgb(this.data.hexInput);
      else if (this.data.mode === 'rgb') {
        if (![this.data.red, this.data.green, this.data.blue].every(validByte)) throw new Error('RGB 数值需在 0 至 255 之间');
        rgb = { r: Number(this.data.red), g: Number(this.data.green), b: Number(this.data.blue) };
      } else {
        const hue = Number(this.data.hue);
        if (!Number.isFinite(hue) || hue < 0 || hue > 360 || !validPercent(this.data.saturation) || !validPercent(this.data.lightness)) throw new Error('H 需在 0 至 360，S/L 需在 0 至 100');
        rgb = hslToRgb(hue, Number(this.data.saturation), Number(this.data.lightness));
      }
      this.applyColor(buildResult(rgb.r, rgb.g, rgb.b));
      app.recordRecent(TOOL);
    } catch (error) { this.setData({ error: error.message || '颜色格式有误', saved: false }); }
  },
  applyColor(result, saved = false) {
    const match = result.hsl.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
    this.setData({ result, hexInput: result.hex, red: String(result.r), green: String(result.g), blue: String(result.b), hue: match ? match[1] : '0', saturation: match ? match[2] : '0', lightness: match ? match[3] : '0', error: '', saved });
  },
  copyValue(event) { const value = this.data.result && this.data.result[event.currentTarget.dataset.key]; if (value) wx.setClipboardData({ data: value, success: () => wx.showToast({ title: '颜色值已复制' }) }); },
  async saveRecord() {
    if (!this.data.result || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次颜色已保存' : '请先查询颜色', icon: 'none' });
    this.setData({ saving: true });
    try { await app.recordOperation({ ...TOOL, colorValue: this.data.result.hex, modeLabel: this.data.result.hex, detailText: `${this.data.result.rgb} · ${this.data.result.hsl}`, text: `${this.data.result.hex}\n${this.data.result.rgb}\n${this.data.result.hsl}\n${this.data.result.cmyk}` }); this.setData({ saving: false, saved: true }); wx.showToast({ title: '已保存到操作记录' }); }
    catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
