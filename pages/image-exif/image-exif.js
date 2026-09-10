const app = getApp();
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { stripImageMetadata } = require('../../utils/image-exif');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { saveNamedImageToAlbum } = require('../../utils/image-output');

const TOOL = { key: 'image-exif', title: '图片去 EXIF', desc: '清除拍摄设备与位置元数据', icon: 'image-exif', tone: 'green', page: '/pages/image-exif/image-exif' };
const MAX_BYTES = 20 * 1024 * 1024;
const fileSize = path => new Promise(resolve => { if (typeof wx.getFileInfo !== 'function') return resolve(0); wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) }); });
const imageInfo = path => new Promise((resolve, reject) => wx.getImageInfo({ src: path, success: resolve, fail: reject }));

Page({
  data: { file: null, state: 'empty', result: null, error: '' },
  onLoad(options = {}) {
    if (!options.recordId) return;
    const record = app.getOperationRecord(decodeURIComponent(options.recordId));
    const item = record && Array.isArray(record.files) ? record.files[0] : null;
    const outputPath = item && (item.outputPath || record.previewPath);
    if (!record || record.key !== TOOL.key || !outputPath) return;
    this.setData({ file: item, state: 'success', result: { outputPath, outputName: item.outputName || `jituan-image-exif.${item.outputFormat || 'jpg'}`, width: item.outputWidth || item.width || 0, height: item.outputHeight || item.height || 0, formatLabel: String(item.outputFormat || 'jpg').toUpperCase(), originalText: item.sizeText || formatBytes(item.size), outputText: item.outputSizeText || formatBytes(item.outputSize), removedText: Number(item.removedCount) ? `已移除 ${item.removedCount} 个元数据块` : '已生成不携带原始元数据的图片' } });
  },
  onShow() { const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null; if (tabBar) tabBar.setData({ visible: false }); },
  onUnload() { this.cleanupOutput(); },
  cleanupOutput() {
    const path = this._ownedOutput;
    if (!path || typeof wx.getFileSystemManager !== 'function') return;
    this._ownedOutput = '';
    Promise.resolve(this._recordPromise).catch(() => undefined).then(() => wx.getFileSystemManager().unlink({ filePath: path, fail: () => {} }));
  },
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
        this.cleanupOutput();
        this.setData({ file, state: 'empty', result: null, error: '' });
      } catch (error) { wx.showToast({ title: error && error.message ? error.message : '图片读取失败，请重试', icon: 'none', duration: 2600 }); }
    };
    const fail = error => { if (!/cancel/i.test(String(error && error.errMsg || ''))) wx.showToast({ title: '无法打开图片选择器', icon: 'none' }); };
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'], success, fail });
    else wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success, fail });
  },
  removeExif() {
    if (!this.data.file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    if (this.data.state === 'processing') return;
    const file = this.data.file;
    this.cleanupOutput();
    this.setData({ state: 'processing', result: null, error: '' });
    app.recordRecent(TOOL);
    stripImageMetadata(file.path).then(result => {
      const view = { ...result, outputName: result.outputName || `jituan-image-exif.${result.outputFormat || 'jpg'}`, width: file.width, height: file.height, formatLabel: String(result.outputFormat).toUpperCase(), originalText: formatBytes(file.size), outputText: formatBytes(result.bytes), removedText: result.removedCount ? `已移除 ${result.removedCount} 个元数据块` : '未发现隐私元数据，已生成干净副本' };
      this._ownedOutput = result.outputPath;
      this.setData({ state: 'success', result: view });
      this._recordPromise = app.recordOperation({ ...TOOL, modeLabel: '元数据已清除', detailText: `${view.width} × ${view.height} px · ${view.removedText}`, files: [{ ...file, outputPath: result.outputPath, outputName: view.outputName, outputFormat: result.outputFormat, outputSize: result.bytes, outputSizeText: view.outputText, outputWidth: file.width, outputHeight: file.height, removedCount: result.removedCount }] }).catch(() => {});
    }).catch(error => this.setData({ state: 'error', error: error && error.message ? error.message : '元数据清除失败，请重试' }));
  },
  previewSource() { if (this.data.file) wx.previewImage({ current: this.data.file.path, urls: [this.data.file.path] }); },
  previewResult() { if (this.data.result) wx.previewImage({ current: this.data.result.outputPath, urls: [this.data.result.outputPath] }); },
  saveResult() { if (!this.data.result) return; saveNamedImageToAlbum(this.data.result.outputPath, 'jituan-image-exif', this.data.result.outputFormat, this.data.result.outputName).then(() => wx.showToast({ title: '已保存到相册' })).catch(() => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })); },
  reset() { this.cleanupOutput(); this.setData({ file: null, state: 'empty', result: null, error: '' }); },
  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
