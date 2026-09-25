const app = getApp();
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { formatBytes } = require('../../utils/format');
const { saveNamedImageToAlbum } = require('../../utils/image-output');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'image-mask', title: '图片隐私遮挡', desc: '遮住截图中的敏感信息', icon: 'image-mask', tone: 'gray', page: '/pages/image-mask/image-mask' };
const MAX_BYTES = 20 * 1024 * 1024;

const getFileInfo = path => new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: reject }));
const getSize = path => new Promise(resolve => wx.getFileInfo({ filePath: path, success: result => resolve(Number(result.size) || 0), fail: () => resolve(0) }));

Page({
  data: { file: null, displayWidth: 320, displayHeight: 240, maskMode: 'solid', masks: [], resultPath: '', error: '' },
  onLoad(options = {}) {
    this._recordId = options.recordId ? decodeURIComponent(options.recordId) : '';
    this._canvas = null;
    this._image = null;
    this._outputPath = '';
    if (this._recordId) {
      const record = app.getOperationRecord(this._recordId);
      const item = record && Array.isArray(record.files) ? record.files[0] : null;
      const outputPath = item && (item.outputPath || record.previewPath);
      if (record && record.key === TOOL.key && outputPath) {
        this.setData({ file: null, resultPath: outputPath, error: '' });
      }
    }
  },
  onShow() { const tabBar = this.getTabBar && this.getTabBar(); if (tabBar) tabBar.setData({ visible: false }); },
  onUnload() { this.cleanupOutput(); },
  cleanupOutput() {
    if (!this._outputPath || !wx.getFileSystemManager) return;
    const path = this._outputPath;
    this._outputPath = '';
    Promise.resolve(this._recording).catch(() => {}).then(() => wx.getFileSystemManager().unlink({ filePath: path, fail: () => {} }));
  },
  async chooseImage() {
    if (!await requestConsent()) return;
    const success = async response => {
      const raw = response && response.tempFiles && response.tempFiles[0] ? response.tempFiles[0] : ((response && response.tempFilePaths) || [])[0];
      const path = typeof raw === 'string' ? raw : raw && (raw.tempFilePath || raw.path);
      if (!path) return;
      try {
        const info = await getFileInfo(path);
        const size = Number(raw && raw.size) || await getSize(path);
        if (size > MAX_BYTES) return wx.showToast({ title: '单张图片不能超过 20MB', icon: 'none' });
        const file = { path, name: String(path).split('/').pop() || '待处理图片', size, sizeText: formatBytes(size), width: Number(info.width) || 0, height: Number(info.height) || 0, type: info.type || 'image/jpeg' };
        await checkSelectedImages([file]);
        this.cleanupOutput();
        const windowInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : { windowWidth: 375 };
        const displayWidth = Math.max(240, Number(windowInfo.windowWidth || 375) - 64);
        const scale = Math.min(1, 1600 / Math.max(file.width, file.height));
        const renderWidth = Math.max(1, Math.round(file.width * scale));
        const renderHeight = Math.max(1, Math.round(file.height * scale));
        const displayScale = Math.min(1, 430 / renderHeight, displayWidth / renderWidth);
        this.setData({ file, displayWidth: Math.round(renderWidth * displayScale), displayHeight: Math.round(renderHeight * displayScale), masks: [], resultPath: '', error: '' }, () => this.prepareCanvas(renderWidth, renderHeight));
      } catch (error) { wx.showToast({ title: error && error.message ? error.message : '图片读取失败，请重试', icon: 'none', duration: 2600 }); }
    };
    const fail = error => { if (!/cancel/i.test(String(error && error.errMsg || ''))) wx.showToast({ title: '无法打开图片选择器', icon: 'none' }); };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success, fail });
    else wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success, fail });
  },
  prepareCanvas(renderWidth, renderHeight) {
    wx.createSelectorQuery().select('#maskCanvas').fields({ node: true, size: true }).exec(result => {
      const canvas = result && result[0] && result[0].node;
      if (!canvas) return this.setData({ error: '画布初始化失败，请重新选择图片' });
      canvas.width = renderWidth; canvas.height = renderHeight; this._canvas = canvas; this._renderWidth = renderWidth; this._renderHeight = renderHeight;
      this._image = canvas.createImage();
      this._image.onload = () => this.renderCanvas();
      this._image.onerror = () => this.setData({ error: '图片加载失败，请重新选择' });
      this._image.src = this.data.file.path;
    });
  },
  renderCanvas() {
    if (!this._canvas || !this._image) return;
    const context = this._canvas.getContext('2d');
    context.clearRect(0, 0, this._renderWidth, this._renderHeight);
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, this._renderWidth, this._renderHeight);
    context.drawImage(this._image, 0, 0, this._renderWidth, this._renderHeight);
    this.data.masks.forEach(mask => {
      if (mask.mode === 'mosaic' || (!mask.mode && this.data.maskMode === 'mosaic')) {
        const width = Math.max(1, Math.min(mask.w, this._renderWidth - mask.x));
        const height = Math.max(1, Math.min(mask.h, this._renderHeight - mask.y));
        const block = Math.max(10, Math.round(Math.max(this._renderWidth, this._renderHeight) / 60));
        try {
          const pixels = context.getImageData(mask.x, mask.y, width, height).data;
          for (let y = 0; y < height; y += block) {
            for (let x = 0; x < width; x += block) {
              const sampleX = Math.min(width - 1, x + Math.floor(block / 2));
              const sampleY = Math.min(height - 1, y + Math.floor(block / 2));
              const offset = (sampleY * width + sampleX) * 4;
              context.fillStyle = `rgb(${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]})`;
              context.fillRect(mask.x + x, mask.y + y, Math.min(block, width - x), Math.min(block, height - y));
            }
          }
        } catch (error) {
          context.fillStyle = '#52657E'; context.fillRect(mask.x, mask.y, width, height);
        }
      } else { context.fillStyle = '#24354D'; context.fillRect(mask.x, mask.y, mask.w, mask.h); }
    });
  },
  addMask(event) {
    if (!this.data.file || !this._renderWidth) return;
    const touch = event && event.touches && event.touches[0]; if (!touch) return;
    const x = Math.max(0, Math.min(this._renderWidth, Number(touch.x) / this.data.displayWidth * this._renderWidth));
    const y = Math.max(0, Math.min(this._renderHeight, Number(touch.y) / this.data.displayHeight * this._renderHeight));
    const w = Math.max(100, Math.round(this._renderWidth * .3)); const h = Math.max(54, Math.round(this._renderHeight * .11));
    const masks = this.data.masks.concat({ x: Math.max(0, Math.min(this._renderWidth - w, Math.round(x - w / 2))), y: Math.max(0, Math.min(this._renderHeight - h, Math.round(y - h / 2))), w, h, mode: this.data.maskMode });
    this.setData({ masks, resultPath: '' }, () => this.renderCanvas());
  },
  selectMode(event) { const mode = event.currentTarget.dataset.mode; if (['solid', 'mosaic'].includes(mode)) this.setData({ maskMode: mode }); },
  undoMask() { if (!this.data.masks.length) return; this.setData({ masks: this.data.masks.slice(0, -1), resultPath: '' }, () => this.renderCanvas()); },
  clearMasks() { this.setData({ masks: [], resultPath: '' }, () => this.renderCanvas()); },
  exportResult() {
    if (!this._canvas || !this.data.masks.length) return wx.showToast({ title: '请先点击图片添加遮挡', icon: 'none' });
    this.renderCanvas();
    wx.canvasToTempFilePath({ canvas: this._canvas, x: 0, y: 0, width: this._renderWidth, height: this._renderHeight, destWidth: this._renderWidth, destHeight: this._renderHeight, fileType: 'jpg', quality: .92, success: result => {
      if (!result || !result.tempFilePath) return this.setData({ error: '导出失败，请重试' });
      this.cleanupOutput(); this._outputPath = result.tempFilePath; const outputName = `jituan-image-mask-${Date.now()}.jpg`;
      getSize(result.tempFilePath).then(size => {
        const sizeText = formatBytes(size);
        this.setData({ resultPath: result.tempFilePath, error: '' });
        app.recordRecent(TOOL);
        // Privacy records retain the redacted result only, never the sensitive source image.
        this._recording = app.recordOperation({ ...TOOL, modeLabel: `${this.data.masks.length} 处隐私遮挡`, detailText: `${this._renderWidth} × ${this._renderHeight} px · ${sizeText}`, files: [{ path: result.tempFilePath, name: outputName, size, sizeText, width: this._renderWidth, height: this._renderHeight, outputPath: result.tempFilePath, outputName, outputFormat: 'jpg', outputSize: size, outputSizeText: sizeText, outputWidth: this._renderWidth, outputHeight: this._renderHeight }] }).catch(() => {});
      });
    }, fail: () => this.setData({ error: '导出失败，请重试' }) });
  },
  previewResult() { if (this.data.resultPath) wx.previewImage({ current: this.data.resultPath, urls: [this.data.resultPath] }); },
  saveResult() { if (!this.data.resultPath) return; saveNamedImageToAlbum(this.data.resultPath, 'jituan-image-mask', 'jpg').then(() => wx.showToast({ title: '已保存到相册' })).catch(() => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
