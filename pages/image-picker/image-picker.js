const app = getApp();
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { colorDetails } = require('../../utils/color');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'image-picker', title: '图片取色器', desc: '点击图片提取像素颜色数值', icon: 'image-picker', tone: 'purple', page: '/pages/image-picker/image-picker' };
const MAX_BYTES = 20 * 1024 * 1024;
const fileSize = path => new Promise(resolve => { if (typeof wx.getFileInfo !== 'function') return resolve(0); wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) }); });
const imageInfo = path => new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: reject }));

Page({
  data: { file: null, color: null, recentColors: [], crosshairStyle: '', rendering: false, saving: false, saved: false },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    if (!record || record.key !== TOOL.key || !record.pickedColor) return;
    const file = Array.isArray(record.files) ? record.files[0] : null;
    this._restorePath = file && file.path || '';
    this.setData({ file, color: record.pickedColor, recentColors: [record.pickedColor], saved: true });
  },
  onReady() { if (this._restorePath) { const path = this._restorePath; this._restorePath = ''; this.renderImage(path); } },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  async chooseImage() {
    if (this.data.rendering || !await requestConsent()) return;
    const success = async response => {
      const raw = response && response.tempFiles && response.tempFiles[0] ? response.tempFiles[0] : ((response && response.tempFilePaths) || [])[0];
      const path = typeof raw === 'string' ? raw : raw && (raw.tempFilePath || raw.path);
      if (!path) return;
      try {
        const info = await imageInfo(path);
        const size = Number(raw && raw.size) || await fileSize(path);
        if (size > MAX_BYTES) return wx.showToast({ title: '单张图片不能超过 20MB', icon: 'none' });
        const file = { path, name: String(path).split('/').pop() || '待取色图片', size, sizeText: formatBytes(size), width: Number(info.width) || 0, height: Number(info.height) || 0, type: info.type || '' };
        await checkSelectedImages([file]);
        this.setData({ file, color: null, recentColors: [], crosshairStyle: '', rendering: true, saved: false }, () => this.renderImage(path));
        app.recordRecent(TOOL);
      } catch (error) { this.setData({ rendering: false }); wx.showToast({ title: error && error.message ? error.message : '图片读取失败，请重试', icon: 'none', duration: 2600 }); }
    };
    const fail = error => { if (!/cancel/i.test(String(error && error.errMsg || ''))) wx.showToast({ title: '无法打开图片选择器', icon: 'none' }); };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success, fail });
    else wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success, fail });
  },
  renderImage(path) {
    wx.createSelectorQuery().select('#pickerCanvas').fields({ node: true, size: true }).exec(response => {
      const info = response && response[0];
      const canvas = info && info.node;
      if (!canvas || !info.width || !info.height) { this.setData({ rendering: false }); return wx.showToast({ title: '取色画布初始化失败', icon: 'none' }); }
      const ratio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : (wx.getSystemInfoSync().pixelRatio || 1);
      canvas.width = Math.round(info.width * ratio);
      canvas.height = Math.round(info.height * ratio);
      const context = canvas.getContext('2d');
      context.scale(ratio, ratio);
      const image = canvas.createImage();
      image.onload = () => {
        const scale = Math.min(info.width / image.width, info.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (info.width - width) / 2;
        const y = (info.height - height) / 2;
        context.clearRect(0, 0, info.width, info.height);
        context.drawImage(image, x, y, width, height);
        this._picker = { canvas, context, ratio, width: info.width, height: info.height, imageRect: { x, y, width, height } };
        this.setData({ rendering: false });
        this.sampleAt(x + width / 2, y + height / 2);
      };
      image.onerror = () => { this.setData({ rendering: false }); wx.showToast({ title: '图片绘制失败，请重新选择', icon: 'none' }); };
      image.src = path;
    });
  },
  pickColor(event) {
    if (!this._picker || this.data.rendering) return;
    const point = event.touches && event.touches[0] || event.changedTouches && event.changedTouches[0] || event.detail || {};
    let x = Number(point.x);
    let y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.sampleAt(x, y);
  },
  sampleAt(x, y) {
    const picker = this._picker;
    if (!picker) return;
    const rect = picker.imageRect;
    if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) return wx.showToast({ title: '请点击图片区域取色', icon: 'none' });
    try {
      const pixel = picker.context.getImageData(Math.floor(x * picker.ratio), Math.floor(y * picker.ratio), 1, 1).data;
      const color = colorDetails(pixel[0], pixel[1], pixel[2], pixel[3]);
      const recentColors = [color, ...this.data.recentColors.filter(item => item.rgba !== color.rgba)].slice(0, 8);
      this.setData({ color, recentColors, crosshairStyle: `left:${x}px;top:${y}px;border-color:${color.hex};`, saved: false });
    } catch (_) { wx.showToast({ title: '当前微信版本无法读取像素颜色', icon: 'none' }); }
  },
  chooseRecent(event) { const color = this.data.recentColors[Number(event.currentTarget.dataset.index)]; if (color) this.setData({ color, saved: false }); },
  copyValue(event) { const key = event.currentTarget.dataset.key; const value = this.data.color && this.data.color[key]; if (value) wx.setClipboardData({ data: value, success: () => wx.showToast({ title: '颜色值已复制' }) }); },
  async saveRecord() {
    if (!this.data.file || !this.data.color || this.data.saving || this.data.saved) return wx.showToast({ title: this.data.saved ? '本次颜色已保存' : '请先从图片中取色', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({ ...TOOL, pickedColor: this.data.color, modeLabel: this.data.color.hex, detailText: `${this.data.color.rgba} · ${this.data.color.hsl}`, text: `${this.data.color.hex}\n${this.data.color.rgba}\n${this.data.color.hsl}`, files: [this.data.file] });
      this.setData({ saving: false, saved: true }); wx.showToast({ title: '已保存到操作记录' });
    } catch (_) { this.setData({ saving: false }); wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },
  reset() { this._picker = null; this.setData({ file: null, color: null, recentColors: [], crosshairStyle: '', rendering: false, saved: false }); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
