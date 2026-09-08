const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: {
    files: [],
    mode: 'target',
    quality: 80,
    targetSizeKB: 500,
    targetPreset: '500',
    targetCustomValue: '500',
    targetUnit: 'KB',
    targetSizeLabel: '不超过 500 KB',
    targetError: '',
    progress: 0,
    currentName: '',
    state: 'empty',
    results: [],
    error: ''
  },

  onLoad(options) {
    this._unloaded = false;
    this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : '';
  },

  onUnload() { this._unloaded = true; },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/compress/compress' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || !Array.isArray(record.files) || !record.files.length) return;
    const results = record.files.map((item, index) => {
      const originalBytes = Number(item.size) || 0;
      const compressedBytes = Number(item.outputSize) || originalBytes;
      return {
        ...item,
        id: item.id || `${record.id}-${index}`,
        outputPath: item.outputPath || item.path,
        originalBytes,
        compressedBytes,
        originalText: item.sizeText || formatBytes(originalBytes),
        compressedText: item.outputSizeText || formatBytes(compressedBytes),
        savedPercent: Number.isFinite(Number(item.savedPercent)) ? Number(item.savedPercent) : (originalBytes ? Math.max(0, Math.round((1 - compressedBytes / originalBytes) * 100)) : 0)
      };
    });
    const totalOriginal = results.reduce((sum, item) => sum + item.originalBytes, 0);
    const totalCompressed = results.reduce((sum, item) => sum + item.compressedBytes, 0);
    this.restoredHistoryRecordId = recordId;
    this.setData({
      state: 'success',
      files: record.files,
      results,
      progress: 100,
      totalOriginalText: formatBytes(totalOriginal),
      totalCompressedText: formatBytes(totalCompressed),
      totalSavedPercent: totalOriginal ? Math.max(0, Math.round((1 - totalCompressed / totalOriginal) * 100)) : 0,
      error: ''
    });
  },

  async chooseImages() {
    if (this.data.state === 'processing') return;
    if (!await requestConsent()) return;
    if (this._unloaded || this.data.state === 'processing') return;
    if (this.data.files.length >= 9) return wx.showToast({ title: '最多选择 9 张图片', icon: 'none' });
    const remaining = Math.max(1, 9 - this.data.files.length);
    const onSuccess = async result => {
      // 不同基础库/开发者工具版本可能只返回其中一个字段；优先使用有内容的数组。
      const rawFiles = result && result.tempFiles && result.tempFiles.length
        ? result.tempFiles
        : ((result && result.tempFilePaths) || (result && result.tempFiles) || []);
      const baseCount = this.data.files.length;
      const selected = rawFiles.map((item, index) => {
        // chooseImage 的 tempFiles 使用 path 字段，chooseMedia 使用 tempFilePath；两种格式都要兼容。
        const path = typeof item === 'string' ? item : (item && (item.tempFilePath || item.path || ''));
        const size = typeof item === 'string' ? 0 : (item.size || 0);
        const name = typeof item === 'string' ? '' : (item && item.name ? item.name : '');
        return { path, size, sizeText: formatBytes(size), name: name || `图片${baseCount + index + 1}`, previewFailed: false };
      });
      if (!selected.length) return wx.showToast({ title: '没有选择图片，请重试', icon: 'none' });
      if (selected.some(file => !file.path)) return wx.showToast({ title: '图片路径读取失败，请重新选择', icon: 'none' });
      if (typeof wx.getFileInfo === 'function') {
        await Promise.all(selected.map(file => new Promise(resolve => wx.getFileInfo({
          filePath: file.path,
          success: info => {
            file.size = info && info.size ? info.size : file.size;
            file.sizeText = formatBytes(file.size);
            resolve();
          },
          fail: () => resolve()
        }))));
      }
      const maxBytes = service.MAX_IMAGE_BYTES || 20 * 1024 * 1024;
      const oversized = selected.filter(file => Number(file.size) > maxBytes);
      const accepted = selected.filter(file => Number(file.size) <= maxBytes || !Number(file.size));
      if (accepted.length) {
        try {
          await checkSelectedImages(accepted);
        } catch (error) {
          return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
        }
      }
      if (this._unloaded || this.data.state === 'processing') return;
      const files = this.data.files.concat(accepted).slice(0, 9);
      this.setData({ files, state: 'empty', results: [], error: '' });
      if (oversized.length) {
        wx.showToast({ title: oversized.length === 1 ? '单张图片不能超过 20MB' : `${oversized.length} 张图片超过 20MB，已忽略`, icon: 'none', duration: 2600 });
      }
    };
    const onFail = error => {
      const reason = error && error.errMsg ? error.errMsg : '';
      if (/privacy|隐私/i.test(reason)) return wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      if (/auth|permission|权限/i.test(reason)) return wx.showToast({ title: '请在手机设置中允许访问相册', icon: 'none' });
      wx.showToast({ title: '未能打开本地图片，请重试', icon: 'none' });
    };
    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: remaining, sizeType: ['original', 'compressed'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: remaining, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else onFail();
  },

  previewImage(event) {
    const files = this.data.files.filter(file => file.path);
    const current = this.data.files[event.currentTarget.dataset.index];
    if (!current || !current.path || !files.length) return;
    wx.previewImage({ current: current.path, urls: files.map(file => file.path) });
  },

  onPreviewError(event) {
    const index = Number(event.currentTarget.dataset.index);
    const files = this.data.files.slice();
    if (!files[index]) return;
    files[index].previewFailed = true;
    this.setData({ files });
  },

  removeFile(event) {
    if (this.data.state === 'processing') return;
    const files = this.data.files.slice();
    files.splice(event.currentTarget.dataset.index, 1);
    this.setData({ files, state: 'empty', results: [] });
  },

  setMode(event) {
    if (this.data.state === 'processing') return;
    this.setData({ mode: event.currentTarget.dataset.mode, targetError: '' });
  },

  setTargetSize(event) {
    if (this.data.state === 'processing') return;
    const targetSizeKB = Number(event.currentTarget.dataset.target);
    const label = targetSizeKB >= 1024 ? `不超过 ${targetSizeKB / 1024} MB` : `不超过 ${targetSizeKB} KB`;
    const targetCustomValue = this.data.targetUnit === 'MB'
      ? String(targetSizeKB / 1024)
      : String(targetSizeKB);
    this.setData({ targetSizeKB, targetPreset: String(targetSizeKB), targetCustomValue, targetSizeLabel: label, targetError: '' });
  },

  selectCustomTarget() {
    if (this.data.state === 'processing') return;
    this.setData({ mode: 'target', targetPreset: 'custom', targetError: '' });
    this.syncCustomTarget();
  },

  setTargetUnit(event) {
    if (this.data.state === 'processing') return;
    const targetUnit = event.currentTarget.dataset.unit;
    if (targetUnit === this.data.targetUnit) return;
    const currentKB = Number(this.data.targetSizeKB) || 500;
    const targetCustomValue = targetUnit === 'MB'
      ? String(currentKB / 1024)
      : String(currentKB);
    this.setData({ targetUnit, targetCustomValue, targetPreset: 'custom', targetError: '' }, () => this.syncCustomTarget());
  },

  onTargetInput(event) {
    if (this.data.state === 'processing') return;
    const rawValue = String(event.detail.value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    this.setData({ targetCustomValue: rawValue, targetPreset: 'custom', mode: 'target', targetError: '' }, () => this.syncCustomTarget());
  },

  syncCustomTarget() {
    const value = Number(this.data.targetCustomValue);
    if (!Number.isFinite(value) || value <= 0) {
      this.setData({ targetSizeLabel: '请输入目标大小' });
      return false;
    }
    const targetSizeKB = this.data.targetUnit === 'MB' ? value * 1024 : value;
    const maxTargetKB = 20 * 1024;
    if (targetSizeKB < 80 || targetSizeKB > maxTargetKB) {
      this.setData({ targetSizeLabel: `不超过 ${this.data.targetCustomValue} ${this.data.targetUnit}`, targetError: '目标大小需在 80 KB 至 20 MB 之间' });
      return false;
    }
    this.setData({ targetSizeKB, targetSizeLabel: `不超过 ${this.data.targetCustomValue} ${this.data.targetUnit}`, targetError: '' });
    return true;
  },

  validateTarget() {
    if (this.data.mode !== 'target' || this.data.targetPreset !== 'custom') return true;
    const value = Number(this.data.targetCustomValue);
    const targetSizeKB = this.data.targetUnit === 'MB' ? value * 1024 : value;
    if (!Number.isFinite(value) || value <= 0 || targetSizeKB < 80 || targetSizeKB > 20 * 1024) {
      this.setData({ targetError: '目标大小需在 80 KB 至 20 MB 之间' });
      wx.showToast({ title: '请输入有效的目标大小', icon: 'none' });
      return false;
    }
    this.setData({ targetSizeKB });
    return true;
  },

  onQuality(event) { if (this.data.state !== 'processing') this.setData({ quality: event.detail.value }); },

  startCompress() {
    if (this._unloaded || this.data.state === 'processing') return;
    if (!this.data.files.length) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    if (!this.validateTarget()) return;
    const maxBytes = service.MAX_IMAGE_BYTES || 20 * 1024 * 1024;
    const oversized = this.data.files.find(file => Number(file.size) > maxBytes);
    if (oversized) {
      this.setData({ state: 'error', error: `${oversized.name || '图片'}：单张图片不能超过 20MB` });
      return;
    }
    const files = this.data.files.slice();
    const config = { mode: this.data.mode, quality: this.data.quality, targetSizeKB: this.data.targetSizeKB };
    const modeLabel = config.mode === 'target' ? `目标大小 · ${this.data.targetSizeLabel}` : (config.mode === 'custom' ? `自定义质量 · ${config.quality}%` : '自动压缩');
    this.setData({ state: 'processing', progress: 0, currentName: files[0].name, error: '' });
    track('tool_start', { tool: 'compress', count: this.data.files.length, mode: this.data.mode });
    app.recordRecent({ key: 'compress', title: '图片压缩', desc: '压小图片体积，方便发送和上传', icon: 'compress', tone: 'blue', page: '/pages/compress/compress' });
    return service.compressImages(files, config, progress => {
      if (this._unloaded) return;
      this.setData({ progress: Math.round(progress.completed / progress.total * 100), currentName: progress.current });
    }, () => this._unloaded).then(results => {
      if (this._unloaded) return;
      const totalOriginal = results.reduce((sum, item) => sum + item.originalBytes, 0);
      const totalCompressed = results.reduce((sum, item) => sum + item.compressedBytes, 0);
      const displayResults = results.map(item => ({ ...item, originalText: formatBytes(item.originalBytes), compressedText: formatBytes(item.compressedBytes), savedPercent: Math.max(0, Math.round((1 - item.compressedBytes / item.originalBytes) * 100)) }));
      this.setData({ state: 'success', progress: 100, results: displayResults, totalOriginalText: formatBytes(totalOriginal), totalCompressedText: formatBytes(totalCompressed), totalSavedPercent: Math.max(0, Math.round((1 - totalCompressed / totalOriginal) * 100)) });
      app.recordOperation({ key: 'compress', title: '图片压缩', desc: '压小图片体积，方便发送和上传', icon: 'compress', tone: 'blue', page: '/pages/compress/compress', modeLabel, detailText: `${results.length} 张图片 · ${formatBytes(totalOriginal)} → ${formatBytes(totalCompressed)}`, files: results.map(item => ({ path: item.path, outputPath: item.outputPath, name: item.name, size: item.originalBytes, sizeText: formatBytes(item.originalBytes), outputSize: item.compressedBytes, outputSizeText: formatBytes(item.compressedBytes), targetBytes: item.targetBytes || 0, targetMet: !!item.targetMet, keptOriginal: !!item.keptOriginal, resized: !!item.resized, width: item.width || 0, height: item.height || 0, outputFormat: item.outputFormat || '', savedPercent: Math.max(0, Math.round((1 - item.compressedBytes / item.originalBytes) * 100)) })) }).catch(() => {});
      track('tool_success', { tool: 'compress', count: results.length });
    }).catch(error => {
      if (this._unloaded) return;
      track('tool_error', { tool: 'compress', reason: 'service_error' });
      const rawMessage = error && error.message ? error.message : '';
      const message = rawMessage.includes('格式') ? '当前图片格式暂不支持，请选择 JPG、JPEG、PNG、BMP、WEBP、JFIF 或 JPE 图片。' : (rawMessage || '图片处理失败，可能是文件过大或临时文件已失效，请重新选择图片。');
      this.setData({ state: 'error', error: message });
    });
  },

  saveOne(item) {
    return new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: item.outputPath, success: resolve, fail: reject }));
  },

  previewResult(event) {
    const item = this.data.results[Number(event.currentTarget.dataset.index)];
    if (item && item.outputPath) wx.previewImage({ current: item.outputPath, urls: this.data.results.map(result => result.outputPath).filter(Boolean) });
  },

  saveResult(event) {
    const item = this.data.results[event.currentTarget.dataset.index];
    if (!item || !item.outputPath) return wx.showToast({ title: '当前结果没有可保存的文件', icon: 'none' });
    this.saveOne(item).then(() => { track('result_save', { tool: 'compress' }); wx.showToast({ title: '已保存到相册' }); }).catch(() => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false }));
  },

  saveAll() {
    const items = this.data.results.filter(item => item.outputPath);
    if (!items.length) return wx.showToast({ title: '当前没有可保存的结果', icon: 'none' });
    Promise.all(items.map(item => this.saveOne(item))).then(() => { track('result_save_all', { tool: 'compress', count: items.length }); wx.showToast({ title: `已保存 ${items.length} 张图片` }); }).catch(() => wx.showModal({ title: '保存失败', content: '部分图片保存失败，请检查相册权限后重试。', showCancel: false }));
  },

  retry() { this.startCompress(); },
  chooseAgain() {
    this.historyRecordId = '';
    this.restoredHistoryRecordId = '';
    this.setData({ files: [], results: [], progress: 0, currentName: '', state: 'empty', error: '', targetError: '' });
    this.chooseImages();
  },
  goHome() { wx.navigateBack({ delta: 1 }); }
});
