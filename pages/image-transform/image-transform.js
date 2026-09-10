const app = getApp();
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { transformImage } = require('../../utils/image-transform');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { saveNamedImageToAlbum } = require('../../utils/image-output');

const TOOL = { key: 'image-transform', title: '图片旋转翻转', desc: '旋转角度，水平垂直镜像翻转', icon: 'image-transform', tone: 'green', page: '/pages/image-transform/image-transform' };
const MAX_BYTES = 20 * 1024 * 1024;

const fileSize = path => new Promise(resolve => {
  if (typeof wx.getFileInfo !== 'function') return resolve(0);
  wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) });
});
const imageInfo = path => new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: reject }));

Page({
  data: { file: null, rotation: 0, flipX: false, flipY: false, transformStyle: 'rotate(0deg) scale(1,1)', state: 'empty', result: null, error: '' },

  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    const item = record && Array.isArray(record.files) ? record.files[0] : null;
    const outputPath = item && (item.outputPath || record.previewPath);
    if (!record || record.key !== TOOL.key || !outputPath) return;
    this.setData({ file: item, rotation: Number(record.rotation) || 0, flipX: Boolean(record.flipX), flipY: Boolean(record.flipY), state: 'success', result: { outputPath, outputName: item.outputName || `jituan-image-transform.${item.outputFormat || 'jpg'}`, width: item.outputWidth || 0, height: item.outputHeight || 0, formatLabel: String(item.outputFormat || 'jpg').toUpperCase(), sizeText: item.outputSizeText || formatBytes(item.outputSize) } });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },

  updatePreview(patch = {}) {
    const next = { rotation: this.data.rotation, flipX: this.data.flipX, flipY: this.data.flipY, ...patch };
    next.transformStyle = `rotate(${next.rotation}deg) scale(${next.flipX ? -1 : 1},${next.flipY ? -1 : 1})`;
    this.setData({ ...next, state: 'empty', result: null, error: '' });
  },
  rotate(event) { this.updatePreview({ rotation: (this.data.rotation + Number(event.currentTarget.dataset.angle) + 360) % 360 }); },
  toggleFlip(event) { const axis = event.currentTarget.dataset.axis; this.updatePreview(axis === 'x' ? { flipX: !this.data.flipX } : { flipY: !this.data.flipY }); },
  resetTransform() { this.updatePreview({ rotation: 0, flipX: false, flipY: false }); },

  async chooseImage() {
    if (this.data.state === 'processing' || !await requestConsent()) return;
    const success = async response => {
      const raw = response && response.tempFiles && response.tempFiles[0] ? response.tempFiles[0] : ((response && response.tempFilePaths) || [])[0];
      const path = typeof raw === 'string' ? raw : raw && (raw.tempFilePath || raw.path);
      if (!path) return;
      try {
        const info = await imageInfo(path);
        const size = Number(raw && raw.size) || await fileSize(path);
        if (size > MAX_BYTES) return wx.showToast({ title: '单张图片不能超过 20MB', icon: 'none' });
        const file = { path, name: String(path).split('/').pop() || '待处理图片', size, sizeText: formatBytes(size), width: Number(info.width) || 0, height: Number(info.height) || 0, type: info.type || '' };
        await checkSelectedImages([file]);
        this.setData({ file, rotation: 0, flipX: false, flipY: false, transformStyle: 'rotate(0deg) scale(1,1)', state: 'empty', result: null, error: '' });
      } catch (error) { wx.showToast({ title: error && error.message ? error.message : '图片读取失败，请重试', icon: 'none', duration: 2600 }); }
    };
    const fail = error => { if (!/cancel/i.test(String(error && error.errMsg || ''))) wx.showToast({ title: '无法打开图片选择器', icon: 'none' }); };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success, fail });
    else wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success, fail });
  },

  startTransform() {
    if (!this.data.file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    if (this.data.rotation === 0 && !this.data.flipX && !this.data.flipY) return wx.showToast({ title: '请先选择旋转或翻转方式', icon: 'none' });
    if (this.data.state === 'processing') return;
    const options = { rotation: this.data.rotation, flipX: this.data.flipX, flipY: this.data.flipY };
    this.setData({ state: 'processing', result: null, error: '' });
    app.recordRecent(TOOL);
    transformImage(this.data.file, options).then(result => {
      const view = { ...result, outputName: result.outputName || `jituan-image-transform.${result.outputFormat || 'jpg'}`, formatLabel: result.outputFormat.toUpperCase(), sizeText: formatBytes(result.bytes) };
      this.setData({ state: 'success', result: view });
      const labels = [`旋转 ${options.rotation}°`];
      if (options.flipX) labels.push('水平翻转');
      if (options.flipY) labels.push('垂直翻转');
      app.recordOperation({ ...TOOL, rotation: options.rotation, flipX: options.flipX, flipY: options.flipY, modeLabel: labels.join(' · '), detailText: `${view.width} × ${view.height} px · ${view.sizeText}`, files: [{ ...this.data.file, outputPath: result.outputPath, outputName: view.outputName, outputFormat: result.outputFormat, outputSize: result.bytes, outputSizeText: view.sizeText, outputWidth: result.width, outputHeight: result.height }] }).catch(() => {});
    }).catch(error => this.setData({ state: 'error', error: error && error.message ? error.message : '图片处理失败，请重试' }));
  },

  previewSource() { if (this.data.file) wx.previewImage({ current: this.data.file.path, urls: [this.data.file.path] }); },
  previewResult() { if (this.data.result) wx.previewImage({ current: this.data.result.outputPath, urls: [this.data.result.outputPath] }); },
  saveResult() { if (!this.data.result) return; saveNamedImageToAlbum(this.data.result.outputPath, 'jituan-image-transform', this.data.result.outputFormat, this.data.result.outputName).then(() => wx.showToast({ title: '已保存到相册' })).catch(() => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })); },
  newImage() { this.setData({ file: null, rotation: 0, flipX: false, flipY: false, transformStyle: 'rotate(0deg) scale(1,1)', state: 'empty', result: null, error: '' }); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
