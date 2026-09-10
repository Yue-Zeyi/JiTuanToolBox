const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { outputName, saveNamedImageToAlbum } = require('../../utils/image-output');

const COLORS = [
  { key: '#FFFFFF', title: '白色' }, { key: '#15233B', title: '深蓝' },
  { key: '#2F80ED', title: '蓝色' }, { key: '#22A06B', title: '绿色' },
  { key: '#F59E0B', title: '橙色' }, { key: '#FACC15', title: '黄色' },
  { key: '#E05252', title: '红色' }, { key: '#7C5CE7', title: '紫色' }
];
const POSITIONS = [
  { key: 'top-left', title: '左上' }, { key: 'top-center', title: '顶部居中' }, { key: 'top-right', title: '右上' },
  { key: 'center', title: '居中' }, { key: 'bottom-left', title: '左下' }, { key: 'bottom-center', title: '底部居中' },
  { key: 'bottom-right', title: '右下' }, { key: 'tile', title: '平铺' }
];
const fileExtension = value => { const match = String(value || '').match(/\.([a-z0-9]+)(?:[?#].*)?$/i); return match ? match[1].toLowerCase() : ''; };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hexToHsv(hex) {
  const value = String(hex || '#FFFFFF').replace('#', '');
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max ? (delta / max) * 100 : 0, brightness: max * 100 };
}

function hsvToHex(hue, saturation, brightness) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const v = clamp(brightness, 0, 100) / 100;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const match = v - chroma;
  let red = 0; let green = 0; let blue = 0;
  if (h < 60) { red = chroma; green = x; }
  else if (h < 120) { red = x; green = chroma; }
  else if (h < 180) { green = chroma; blue = x; }
  else if (h < 240) { green = x; blue = chroma; }
  else if (h < 300) { red = x; blue = chroma; }
  else { red = chroma; blue = x; }
  const toHex = value => Math.round((value + match) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function pickerStateFromColor(color) {
  const hsv = hexToHsv(color);
  return {
    hue: hsv.hue,
    saturation: hsv.saturation,
    brightness: hsv.brightness,
    pickerHueColor: hsvToHex(hsv.hue, 100, 100),
    customColorInput: hsvToHex(hsv.hue, hsv.saturation, hsv.brightness),
    customColorPreview: hsvToHex(hsv.hue, hsv.saturation, hsv.brightness),
    pickerAreaMarkerLeft: `${hsv.saturation}%`,
    pickerAreaMarkerTop: `${100 - hsv.brightness}%`,
    hueMarkerLeft: `${(hsv.hue / 360) * 100}%`
  };
}

function readFileInfo(path) {
  if (typeof wx.getFileInfo !== 'function') return Promise.resolve(0);
  return new Promise(resolve => wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) }));
}

function readImageInfo(path) {
  if (typeof wx.getImageInfo !== 'function') return Promise.resolve(null);
  return new Promise(resolve => wx.getImageInfo({ src: path, success: resolve, fail: () => resolve(null) }));
}

Page({
  data: {
    file: null, colors: COLORS, color: '#FFFFFF', positions: POSITIONS, position: 'bottom-right',
    customColorInput: '#FFFFFF', customColorPreview: '#FFFFFF', colorError: '',
    hue: 0, saturation: 0, brightness: 100, pickerHueColor: '#FF0000', pickerAreaMarkerLeft: '0%', pickerAreaMarkerTop: '0%', hueMarkerLeft: '0%',
    text: '极团工具箱', fontSize: 44, opacity: 55, rotate: -18, spacing: 220,
    outputFormat: 'jpg', quality: 90, state: 'empty', result: null, error: ''
  },

  onLoad(options) { this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : ''; },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() { return getShareAppMessage({ path: '/pages/watermark/watermark' }); },
  onShareTimeline() { return getShareTimeline(); },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record) return;
    const file = Array.isArray(record.files) && record.files[0] ? record.files[0] : null;
    const outputPath = (file && file.outputPath) || record.outputPath || '';
    if (!outputPath) return;
    this.restoredHistoryRecordId = recordId;
    const savedColor = record.watermarkColor || '#FFFFFF';
    this.setData({ file: file ? { ...file, path: file.path || '', sizeText: file.sizeText || formatBytes(file.size || 0) } : null, text: record.watermarkText || '极团工具箱', color: savedColor, ...pickerStateFromColor(savedColor), colorError: '', position: record.watermarkPosition || 'bottom-right', outputFormat: record.outputFormat || 'jpg', state: 'success', result: { outputPath, outputName: file && file.outputName || record.outputName || outputName('jituan-watermark', record.outputFormat || 'jpg'), outputFormat: record.outputFormat || 'jpg', width: record.outputWidth || 0, height: record.outputHeight || 0, size: record.outputSize || 0, sizeText: formatBytes(record.outputSize || 0), text: record.watermarkText || '极团工具箱' }, error: '' });
  },

  async chooseImage() {
    if (this.data.state === 'processing') return;
    if (!await requestConsent()) return;
    const onSuccess = async response => {
      const raw = response && response.tempFiles && response.tempFiles[0] ? response.tempFiles[0] : ((response && response.tempFilePaths) || [])[0];
      const path = typeof raw === 'string' ? raw : raw && (raw.tempFilePath || raw.path || '');
      if (!path) return wx.showToast({ title: '没有选择图片，请重试', icon: 'none' });
      const name = typeof raw === 'object' && raw && raw.name ? raw.name : `图片.${fileExtension(path) || 'jpg'}`;
      const size = await readFileInfo(path) || (typeof raw === 'object' && raw ? Number(raw.size) || 0 : 0);
      if (size > (service.MAX_IMAGE_BYTES || 20 * 1024 * 1024)) return wx.showToast({ title: '单张图片不能超过 20MB', icon: 'none' });
      const ext = fileExtension(name || path);
      if (ext && service.SUPPORTED_IMAGE_EXTENSIONS.indexOf(ext) === -1) return wx.showToast({ title: '当前图片格式暂不支持', icon: 'none' });
      const info = await readImageInfo(path);
      const file = { path, name, size, sizeText: formatBytes(size), type: String(info && info.type || '').toLowerCase(), width: Number(info && info.width) || 0, height: Number(info && info.height) || 0 };
      try {
        await checkSelectedImages([file]);
      } catch (error) {
        return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
      }
      this.historyRecordId = ''; this.restoredHistoryRecordId = '';
      this.setData({ file, state: 'empty', result: null, error: '' });
    };
    const onFail = error => {
      const reason = error && error.errMsg ? error.errMsg : '';
      if (/privacy|隐私/i.test(reason)) return wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      if (/auth|permission|权限/i.test(reason)) return wx.showToast({ title: '请在手机设置中允许访问相册', icon: 'none' });
      wx.showToast({ title: '未能打开本地图片，请重试', icon: 'none' });
    };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    else if (typeof wx.chooseMedia === 'function') wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    else onFail();
  },

  previewImage() { if (this.data.file && this.data.file.path) wx.previewImage({ current: this.data.file.path, urls: [this.data.file.path] }); },
  clearImage() { if (this.data.state !== 'processing') this.setData({ file: null, state: 'empty', result: null, error: '' }); },
  onTextInput(event) { if (this.data.state === 'processing') return; this.setData({ text: String(event.detail.value || '').slice(0, 80), state: 'empty', result: null }); },
  setColor(event) {
    if (this.data.state === 'processing') return;
    const color = event.currentTarget.dataset.color;
    this.setData({ color, ...pickerStateFromColor(color), colorError: '', state: 'empty', result: null });
  },
  updatePickerColor(hue, saturation, brightness) {
    const color = hsvToHex(hue, saturation, brightness);
    this.setData({ color, ...pickerStateFromColor(color), colorError: '', state: 'empty', result: null });
  },
  onPickerAreaTouch(event) {
    if (this.data.state === 'processing') return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    wx.createSelectorQuery().select('#colorPickerArea').boundingClientRect(rect => {
      if (!rect || !rect.width || !rect.height) return;
      const saturation = clamp((touch.clientX - rect.left) / rect.width * 100, 0, 100);
      const brightness = clamp(100 - (touch.clientY - rect.top) / rect.height * 100, 0, 100);
      this.updatePickerColor(this.data.hue, saturation, brightness);
    }).exec();
  },
  onHueTouch(event) {
    if (this.data.state === 'processing') return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    wx.createSelectorQuery().select('#colorHueSlider').boundingClientRect(rect => {
      if (!rect || !rect.width) return;
      const hue = clamp((touch.clientX - rect.left) / rect.width * 360, 0, 359);
      this.updatePickerColor(hue, this.data.saturation, this.data.brightness);
    }).exec();
  },
  setPosition(event) { if (this.data.state === 'processing') return; this.setData({ position: event.currentTarget.dataset.position, state: 'empty', result: null }); },
  onFontSize(event) { if (this.data.state === 'processing') return; this.setData({ fontSize: Number(event.detail.value) || 44, state: 'empty', result: null }); },
  onOpacity(event) { if (this.data.state === 'processing') return; this.setData({ opacity: Number(event.detail.value) || 55, state: 'empty', result: null }); },
  onRotate(event) { if (this.data.state === 'processing') return; this.setData({ rotate: Number(event.detail.value) || 0, state: 'empty', result: null }); },
  onSpacing(event) { if (this.data.state === 'processing') return; this.setData({ spacing: Number(event.detail.value) || 220, state: 'empty', result: null }); },
  setOutputFormat(event) { if (this.data.state === 'processing') return; this.setData({ outputFormat: event.currentTarget.dataset.format, state: 'empty', result: null }); },

  validate() {
    if (!this.data.file) { this.setData({ error: '请先选择一张图片' }); wx.showToast({ title: '请先选择图片', icon: 'none' }); return null; }
    if (!String(this.data.text || '').trim()) { this.setData({ error: '请输入水印文字' }); wx.showToast({ title: '请输入水印文字', icon: 'none' }); return null; }
    return { text: this.data.text, color: this.data.color, position: this.data.position, fontSize: this.data.fontSize, opacity: Number(this.data.opacity) / 100, rotate: this.data.rotate, spacing: this.data.spacing, outputFormat: this.data.outputFormat, quality: this.data.quality };
  },

  startWatermark() {
    const options = this.validate(); if (!options) return;
    this.setData({ state: 'processing', error: '' });
    track('tool_start', { tool: 'watermark' });
    app.recordRecent({ key: 'watermark', title: '图片加水印', desc: '添加文字水印保护图片', icon: 'watermark', tone: 'purple', page: '/pages/watermark/watermark' });
    service.watermarkImage(this.data.file, options, this).then(result => {
      const resultView = { ...result, outputName: outputName('jituan-watermark', result.outputFormat), sizeText: formatBytes(result.compressedBytes), outputPath: result.outputPath };
      this.setData({ state: 'success', result: resultView });
      app.recordOperation({ key: 'watermark', title: '图片加水印', desc: '添加文字水印保护图片', icon: 'watermark', tone: 'purple', page: '/pages/watermark/watermark', watermarkText: options.text, watermarkColor: options.color, watermarkPosition: options.position, outputName: resultView.outputName, outputFormat: result.outputFormat, outputWidth: result.width, outputHeight: result.height, outputSize: result.compressedBytes, modeLabel: `${options.text} · ${result.outputFormat.toUpperCase()}`, detailText: `${result.width} × ${result.height} px · ${resultView.sizeText}`, files: [{ ...this.data.file, outputPath: result.outputPath, outputName: resultView.outputName, outputSize: result.compressedBytes, outputFormat: result.outputFormat }] }).catch(() => {});
      track('tool_success', { tool: 'watermark' });
    }).catch(error => { track('tool_error', { tool: 'watermark', reason: 'local_error' }); this.setData({ state: 'error', error: error && error.message ? error.message : '水印处理失败，请重新选择图片后重试' }); });
  },

  previewResult() { if (this.data.result && this.data.result.outputPath) wx.previewImage({ current: this.data.result.outputPath, urls: [this.data.result.outputPath] }); },
  saveResult() {
    const result = this.data.result;
    if (!result || !result.outputPath) return wx.showToast({ title: '当前没有可保存的结果', icon: 'none' });
    saveNamedImageToAlbum(result.outputPath, 'jituan-watermark', result.outputFormat, result.outputName).then(() => { track('result_save', { tool: 'watermark' }); wx.showToast({ title: '已保存到相册' }); }).catch(() => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false }));
  },
  chooseAgain() { this.historyRecordId = ''; this.restoredHistoryRecordId = ''; this.setData({ file: null, state: 'empty', result: null, error: '' }); this.chooseImage(); },
  retry() { this.startWatermark(); }
});
