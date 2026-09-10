const app = getApp();
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { convertImage } = require('../../utils/image-format');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { saveNamedImageToAlbum } = require('../../utils/image-output');

const TOOL = { key: 'image-format', title: '图片格式转换', desc: 'JPG、PNG 图片格式本地互转', icon: 'image-format', tone: 'blue', page: '/pages/image-format/image-format' };
const MAX_BYTES = 20 * 1024 * 1024;

function readFileSize(path) {
  return new Promise(resolve => {
    if (typeof wx.getFileInfo !== 'function') return resolve(0);
    wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) });
  });
}

function readImageInfo(path) {
  return new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: reject }));
}

function displayName(path, type) {
  const clean = String(path || '').split(/[?#]/)[0];
  const name = clean.split('/').pop() || `待转换图片.${type || 'jpg'}`;
  return name.length > 36 ? `${name.slice(0, 16)}…${name.slice(-15)}` : name;
}

Page({
  data: {
    file: null,
    format: 'jpg',
    quality: 90,
    state: 'empty',
    result: null,
    error: ''
  },

  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    const item = record && Array.isArray(record.files) ? record.files[0] : null;
    const outputPath = item && (item.outputPath || record.previewPath);
    if (!record || record.key !== TOOL.key || !outputPath) return;
    this.setData({
      file: { ...item, path: item.path || '', name: item.name || '原图', sizeText: item.sizeText || formatBytes(item.size) },
      format: item.outputFormat || 'jpg',
      state: 'success',
      result: { outputPath, outputName: item.outputName || `jituan-image-format.${item.outputFormat || 'jpg'}`, outputFormat: item.outputFormat || 'jpg', formatLabel: String(item.outputFormat || 'jpg').toUpperCase(), width: item.outputWidth || item.width || 0, height: item.outputHeight || item.height || 0, sizeText: item.outputSizeText || formatBytes(item.outputSize) }
    });
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  async chooseImage() {
    if (this.data.state === 'processing' || !await requestConsent()) return;
    const success = async response => {
      const raw = response && response.tempFiles && response.tempFiles[0] ? response.tempFiles[0] : ((response && response.tempFilePaths) || [])[0];
      const path = typeof raw === 'string' ? raw : raw && (raw.tempFilePath || raw.path);
      if (!path) return wx.showToast({ title: '没有选择图片，请重试', icon: 'none' });
      try {
        const info = await readImageInfo(path);
        const size = Number(raw && raw.size) || await readFileSize(path);
        if (size > MAX_BYTES) return wx.showToast({ title: '单张图片不能超过 20MB', icon: 'none' });
        const type = String(info.type || '').toLowerCase();
        const file = { path, name: displayName(path, type), size, sizeText: formatBytes(size), width: Number(info.width) || 0, height: Number(info.height) || 0, type };
        await checkSelectedImages([file]);
        this.setData({ file, state: 'empty', result: null, error: '' });
      } catch (error) {
        wx.showToast({ title: error && error.message ? error.message : '图片读取失败，请重新选择', icon: 'none', duration: 2600 });
      }
    };
    const fail = error => {
      if (!/cancel/i.test(String(error && error.errMsg || ''))) wx.showToast({ title: '无法打开图片选择器', icon: 'none' });
    };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success, fail });
    else wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success, fail });
  },

  selectFormat(event) {
    if (this.data.state === 'processing') return;
    const format = event.currentTarget.dataset.format;
    if (format === 'jpg' || format === 'png') this.setData({ format, result: null, state: 'empty', error: '' });
  },

  changeQuality(event) {
    this.setData({ quality: Number(event.detail.value) || 90, result: null, state: 'empty' });
  },

  convert() {
    const file = this.data.file;
    if (!file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    if (this.data.state === 'processing') return;
    this.setData({ state: 'processing', result: null, error: '' });
    app.recordRecent(TOOL);
    convertImage(file, { format: this.data.format, quality: this.data.quality }).then(result => {
      const output = { ...result, outputName: result.outputName || `jituan-image-format.${result.outputFormat || 'jpg'}`, formatLabel: String(result.outputFormat).toUpperCase(), sizeText: formatBytes(result.bytes) };
      this.setData({ state: 'success', result: output });
      app.recordOperation({
        ...TOOL,
        modeLabel: `${String(result.outputFormat).toUpperCase()} 格式`,
        detailText: `${file.width} × ${file.height} px · ${formatBytes(file.size)} → ${output.sizeText}`,
        files: [{ ...file, outputPath: result.outputPath, outputName: output.outputName, outputFormat: result.outputFormat, outputSize: result.bytes, outputSizeText: output.sizeText, outputWidth: result.width, outputHeight: result.height }]
      }).catch(() => {});
    }).catch(error => this.setData({ state: 'error', error: error && error.message ? error.message : '格式转换失败，请重试' }));
  },

  previewSource() {
    if (this.data.file) wx.previewImage({ current: this.data.file.path, urls: [this.data.file.path] });
  },

  previewResult() {
    if (this.data.result) wx.previewImage({ current: this.data.result.outputPath, urls: [this.data.result.outputPath] });
  },

  saveResult() {
    if (!this.data.result) return wx.showToast({ title: '请先完成转换', icon: 'none' });
    saveNamedImageToAlbum(this.data.result.outputPath, 'jituan-image-format', this.data.result.outputFormat, this.data.result.outputName).then(() => wx.showToast({ title: '已保存到相册' })).catch(() => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }));
  },

  reset() { this.setData({ file: null, state: 'empty', result: null, error: '' }); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
