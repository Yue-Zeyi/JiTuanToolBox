const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const clamp = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
const FIT_MODES = [
  { key: 'contain', title: '等比适配', short: '完整保留', description: '保持原图比例，完整保留内容，空白区域自动补白。' },
  { key: 'cover', title: '居中裁剪', short: '铺满画布', description: '保持原图比例，居中裁掉超出画布的部分，适合证件照。' },
  { key: 'stretch', title: '拉伸变形', short: '不留边框', description: '强制填满目标尺寸，不留空白，但宽高比例可能改变。' }
];
const SIZE_PRESETS = [
  { key: 'one-inch', title: '一寸照', size: '25 × 35 mm', pixels: '295 × 413 px', width: 295, height: 413, fitMode: 'cover' },
  { key: 'two-inch', title: '二寸照', size: '35 × 49 mm', pixels: '413 × 579 px', width: 413, height: 579, fitMode: 'cover' },
  { key: 'small-one-inch', title: '小一寸', size: '22 × 32 mm', pixels: '260 × 378 px', width: 260, height: 378, fitMode: 'cover' },
  { key: 'large-one-inch', title: '大一寸', size: '33 × 48 mm', pixels: '390 × 567 px', width: 390, height: 567, fitMode: 'cover' },
  { key: 'avatar', title: '正方形头像', size: '1:1', pixels: '1080 × 1080 px', width: 1080, height: 1080, fitMode: 'cover' },
  { key: 'wide-16-9', title: '16:9 横图', size: '横版图片', pixels: '1920 × 1080 px', width: 1920, height: 1080, fitMode: 'cover' }
];
const getFitMode = key => FIT_MODES.find(item => item.key === key) || FIT_MODES[0];

Page({
  data: {
    file: null,
    mode: 'pixel',
    scaleValue: 100,
    scalePreset: '100',
    preset: 'custom',
    sizePresets: SIZE_PRESETS,
    fitModes: FIT_MODES,
    fitMode: 'contain',
    fitModeDescription: getFitMode('contain').description,
    lockRatio: true,
    originalWidth: 0,
    originalHeight: 0,
    ratio: 1,
    width: 0,
    height: 0,
    format: 'auto',
    quality: 88,
    state: 'empty',
    progress: 0,
    error: '',
    result: null
  },

  onLoad(options) {
    this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : '';
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/resize/resize' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    const item = record && Array.isArray(record.files) ? record.files[0] : null;
    if (!item) return;
    const width = Number(item.outputWidth) || Number(item.width) || 0;
    const height = Number(item.outputHeight) || Number(item.height) || 0;
    if (!width || !height) return;
    const outputPath = item.outputPath || item.path || '';
    const outputFormat = item.outputFormat || ((String(outputPath).match(/\.([a-z0-9]+)(?:[?#].*)?$/i) || [])[1] || 'jpg').toLowerCase();
    const originalBytes = Number(item.size) || 0;
    const compressedBytes = Number(item.outputSize) || originalBytes;
    const originalWidth = Number(item.width) || width;
    const originalHeight = Number(item.height) || height;
    this.restoredHistoryRecordId = recordId;
    this.setData({
      file: { ...item, path: item.path || outputPath, width: originalWidth, height: originalHeight, size: originalBytes, sizeText: item.sizeText || formatBytes(originalBytes), previewFailed: false },
      originalWidth,
      originalHeight,
      ratio: originalHeight ? originalWidth / originalHeight : 1,
      mode: 'pixel',
      preset: 'custom',
      width,
      height,
      state: 'success',
      progress: 100,
      error: '',
      result: {
        ...item,
        outputPath,
        width,
        height,
        outputFormat,
        formatLabel: outputFormat === 'png' ? 'PNG' : 'JPG',
        originalBytes,
        compressedBytes,
        originalText: item.sizeText || formatBytes(originalBytes),
        compressedText: item.outputSizeText || formatBytes(compressedBytes),
        name: `极团工具箱-${width}x${height}.${outputFormat}`
      }
    });
  },

  async chooseImage() {
    if (!await requestConsent()) return;
    const onSuccess = async response => {
      const item = response && response.tempFiles && response.tempFiles.length
        ? response.tempFiles[0]
        : ((response && response.tempFilePaths && response.tempFilePaths[0]) || null);
      const path = typeof item === 'string' ? item : item && (item.tempFilePath || item.path || '');
      if (!path) return wx.showToast({ title: '图片路径读取失败，请重新选择', icon: 'none' });

      let size = typeof item === 'string' ? 0 : (item.size || 0);
      if (typeof wx.getFileInfo === 'function') {
        await new Promise(resolve => wx.getFileInfo({ filePath: path, success: info => { size = info && info.size ? info.size : size; resolve(); }, fail: resolve }));
      }
      if (Number(size) > (service.MAX_IMAGE_BYTES || 20 * 1024 * 1024)) {
        return wx.showToast({ title: '图片超过 20MB', icon: 'none' });
      }
      if (typeof wx.getImageInfo !== 'function') return wx.showToast({ title: '当前微信版本无法读取图片尺寸', icon: 'none' });
      wx.getImageInfo({
        src: path,
        success: async info => {
          const width = Number(info.width) || 0;
          const height = Number(info.height) || 0;
          if (!width || !height) return wx.showToast({ title: '无法读取图片尺寸，请重试', icon: 'none' });
          const file = {
            path,
            size,
            sizeText: formatBytes(size),
            name: (typeof item === 'object' && item.name) || '待修改图片',
            type: info.type || '',
            width,
            height,
            previewFailed: false
          };
          try {
            await checkSelectedImages([file]);
          } catch (error) {
            return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
          }
          this.setData({ file, originalWidth: width, originalHeight: height, ratio: width / height, mode: 'pixel', scaleValue: 100, scalePreset: '100', preset: 'custom', fitMode: 'contain', fitModeDescription: getFitMode('contain').description, width, height, state: 'empty', progress: 0, error: '', result: null });
        },
        fail: () => wx.showToast({ title: '无法读取图片尺寸，请重试', icon: 'none' })
      });
    };
    const onFail = error => {
      const reason = error && error.errMsg ? error.errMsg : '';
      if (/privacy|隐私/i.test(reason)) return wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      if (/auth|permission|权限/i.test(reason)) return wx.showToast({ title: '请在手机设置中允许访问相册', icon: 'none' });
      wx.showToast({ title: '未能打开本地图片，请重试', icon: 'none' });
    };
    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: 1, sizeType: ['original', 'compressed'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else onFail();
  },

  onPreviewError() {
    if (!this.data.file) return;
    this.setData({ 'file.previewFailed': true });
  },

  previewImage() {
    const file = this.data.file;
    if (!file || !file.path) return;
    wx.previewImage({
      current: file.path,
      urls: [file.path]
    });
  },

  setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'percent') {
      const scaleValue = clamp(this.data.scaleValue || 50, 1, 200);
      this.setData({ mode, scaleValue, scalePreset: 'custom', preset: 'custom', width: Math.max(1, Math.round(this.data.originalWidth * scaleValue / 100)), height: Math.max(1, Math.round(this.data.originalHeight * scaleValue / 100)) });
    } else {
      this.setData({ mode, preset: 'custom' });
    }
  },

  setScalePreset(event) {
    const preset = String(event.currentTarget.dataset.preset);
    const scaleValue = clamp(preset, 1, 200);
    this.setData({ mode: 'percent', preset: 'custom', scalePreset: preset, scaleValue, width: Math.max(1, Math.round(this.data.originalWidth * scaleValue / 100)), height: Math.max(1, Math.round(this.data.originalHeight * scaleValue / 100)) });
  },

  setSizePreset(event) {
    const key = event.currentTarget.dataset.preset;
    const preset = SIZE_PRESETS.find(item => item.key === key);
    if (!preset) return;
    const fitMode = preset.fitMode || 'cover';
    this.setData({ mode: 'pixel', preset: preset.key, lockRatio: true, width: preset.width, height: preset.height, fitMode, fitModeDescription: getFitMode(fitMode).description });
  },

  onScaleInput(event) {
    const scaleValue = clamp(event.detail.value, 1, 200);
    this.setData({ mode: 'percent', preset: 'custom', scalePreset: 'custom', scaleValue, width: Math.max(1, Math.round(this.data.originalWidth * scaleValue / 100)), height: Math.max(1, Math.round(this.data.originalHeight * scaleValue / 100)) });
  },

  onWidthInput(event) {
    const width = clamp(event.detail.value, 0, service.MAX_RESIZE_DIMENSION || 4096);
    const height = this.data.lockRatio && this.data.ratio && width ? Math.max(1, Math.round(width / this.data.ratio)) : this.data.height;
    this.setData({ mode: 'pixel', preset: 'custom', width, height });
  },

  onHeightInput(event) {
    const height = clamp(event.detail.value, 0, service.MAX_RESIZE_DIMENSION || 4096);
    const width = this.data.lockRatio && this.data.ratio && height ? Math.max(1, Math.round(height * this.data.ratio)) : this.data.width;
    this.setData({ mode: 'pixel', preset: 'custom', width, height });
  },

  toggleLock() {
    this.setData({ lockRatio: !this.data.lockRatio });
  },

  setFormat(event) {
    this.setData({ format: event.currentTarget.dataset.format });
  },

  setFitMode(event) {
    const fitMode = event.currentTarget.dataset.fit;
    const selected = getFitMode(fitMode);
    this.setData({ fitMode: selected.key, fitModeDescription: selected.description });
  },

  onQuality(event) {
    this.setData({ quality: event.detail.value });
  },

  validateDimensions() {
    const max = service.MAX_RESIZE_DIMENSION || 4096;
    const width = Number(this.data.width);
    const height = Number(this.data.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      this.setData({ error: '请输入有效的宽度和高度' });
      wx.showToast({ title: '请输入有效尺寸', icon: 'none' });
      return false;
    }
    if (width > max || height > max) {
      this.setData({ error: `单边尺寸不能超过 ${max}px` });
      wx.showToast({ title: `最大支持 ${max}px`, icon: 'none' });
      return false;
    }
    return true;
  },

  startResize() {
    if (!this.data.file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    if (!this.validateDimensions()) return;
    this.setData({ state: 'processing', progress: 20, error: '' });
    track('tool_start', { tool: 'resize' });
    app.recordRecent({ key: 'resize', title: '尺寸修改', desc: '调整图片宽高，适配不同场景', icon: 'resize', tone: 'green', page: '/pages/resize/resize' });
    service.resizeImage(this.data.file, { width: this.data.width, height: this.data.height, format: this.data.format, quality: this.data.quality, fitMode: this.data.fitMode }, this).then(result => {
      const formatLabel = result.outputFormat === 'png' ? 'PNG' : 'JPG';
      const originalText = formatBytes(result.originalBytes);
      const compressedText = formatBytes(result.compressedBytes);
      const resultView = { ...result, formatLabel, originalText, compressedText, name: `极团工具箱-${result.width}x${result.height}.${result.outputFormat}` };
      this.setData({ state: 'success', progress: 100, result: resultView });
      app.recordOperation({ key: 'resize', title: '尺寸修改', desc: '调整图片宽高，适配不同场景', icon: 'resize', tone: 'green', page: '/pages/resize/resize', modeLabel: `${result.width} × ${result.height} px`, detailText: `${this.data.file.width} × ${this.data.file.height} px → ${result.width} × ${result.height} px`, files: [{ path: this.data.file.path, outputPath: result.outputPath, outputFormat: result.outputFormat, name: this.data.file.name, size: result.originalBytes, sizeText: originalText, outputSize: result.compressedBytes, outputSizeText: compressedText, width: this.data.file.width, height: this.data.file.height, outputWidth: result.width, outputHeight: result.height }] }).catch(() => {});
      track('tool_success', { tool: 'resize' });
    }).catch(error => {
      track('tool_error', { tool: 'resize', reason: 'service_error' });
      this.setData({ state: 'error', error: error && error.message ? error.message : '尺寸修改失败，请重新选择图片后重试' });
    });
  },

  saveResult() {
    const result = this.data.result;
    if (!result || !result.outputPath) return wx.showToast({ title: '当前没有可保存的结果', icon: 'none' });
    wx.saveImageToPhotosAlbum({ filePath: result.outputPath, success: () => wx.showToast({ title: '已保存到相册' }), fail: () => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false }) });
  },

  chooseAgain() {
    this.historyRecordId = '';
    this.restoredHistoryRecordId = '';
    this.setData({ file: null, state: 'empty', progress: 0, error: '', result: null, width: 0, height: 0 });
    this.chooseImage();
  },

  retry() {
    this.setData({ state: 'empty', error: '' });
    this.startResize();
  },

  goHome() {
    wx.navigateBack({ delta: 1 });
  }
});
