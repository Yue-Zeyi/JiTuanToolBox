const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const GRID_PRESETS = [
  { key: '2x2', rows: 2, cols: 2, title: '2 × 2', desc: '4 块' },
  { key: '3x3', rows: 3, cols: 3, title: '3 × 3', desc: '九宫格' },
  { key: '3x2', rows: 3, cols: 2, title: '3 × 2', desc: '6 块' },
  { key: '2x3', rows: 2, cols: 3, title: '2 × 3', desc: '6 块' },
  { key: '4x4', rows: 4, cols: 4, title: '4 × 4', desc: '16 块' }
];

const fileBaseName = name => String(name || '图片').replace(/\.[^.]+$/, '') || '图片';
const pad = value => String(value).padStart(2, '0');

Page({
  data: {
    file: null,
    gridPresets: GRID_PRESETS,
    preset: '3x3',
    rows: 3,
    cols: 3,
    customRows: '3',
    customCols: '3',
    format: 'auto',
    quality: 88,
    state: 'empty',
    progress: 0,
    currentPart: '',
    resultCount: 0,
    gridLabel: '3 × 3 · 九宫格',
    results: [],
    error: ''
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
    return getShareAppMessage({ path: '/pages/split/split' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || !Array.isArray(record.files) || !record.files.length) return;
    const first = record.files[0];
    const rows = Number(record.rows) || Number(first.rows) || 3;
    const cols = Number(record.cols) || Number(first.cols) || 3;
    const preset = GRID_PRESETS.find(item => item.rows === rows && item.cols === cols);
    const results = record.files.map((item, index) => ({
      ...item,
      id: item.id || `${record.id}-${index}`,
      tileIndex: Number(item.tileIndex) || index + 1,
      outputPath: item.outputPath || item.path,
      outputFormat: item.outputFormat || 'jpg',
      compressedBytes: Number(item.outputSize) || Number(item.compressedBytes) || 0,
      compressedText: item.outputSizeText || formatBytes(Number(item.outputSize) || Number(item.compressedBytes) || 0),
      name: item.name || `${fileBaseName(first.name)}-${pad(index + 1)}.jpg`
    }));
    this.restoredHistoryRecordId = recordId;
    this.setData({
      file: { ...first, path: first.path || first.outputPath, previewFailed: false },
      preset: preset ? preset.key : 'custom',
      rows,
      cols,
      customRows: String(rows),
      customCols: String(cols),
      gridLabel: record.gridLabel || `${rows} × ${cols}`,
      results,
      resultCount: results.length,
      state: 'success',
      progress: 100,
      error: ''
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
      if (Number(size) > (service.MAX_IMAGE_BYTES || 20 * 1024 * 1024)) return wx.showToast({ title: '图片超过 20MB', icon: 'none' });
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
            name: (typeof item === 'object' && item.name) || '待拆分图片',
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
          this.setData({ file, state: 'empty', progress: 0, currentPart: '', resultCount: 0, results: [], error: '' });
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
    wx.previewImage({ current: file.path, urls: [file.path] });
  },

  setPreset(event) {
    const key = event.currentTarget.dataset.preset;
    if (key === 'custom') {
      const rows = Number(this.data.customRows) || 0;
      const cols = Number(this.data.customCols) || 0;
      return this.setData({ preset: 'custom', rows, cols, gridLabel: rows && cols ? `${rows} × ${cols} · 自定义` : '自定义行列', error: '' });
    }
    const preset = GRID_PRESETS.find(item => item.key === key);
    if (!preset) return;
    this.setData({ preset: preset.key, rows: preset.rows, cols: preset.cols, customRows: String(preset.rows), customCols: String(preset.cols), gridLabel: `${preset.title} · ${preset.desc}`, error: '' });
  },

  setCustomRows(event) {
    const raw = String(event.detail.value || '').replace(/[^\d]/g, '').slice(0, 2);
    this.setData({ preset: 'custom', customRows: raw, rows: Number(raw) || 0, gridLabel: raw ? `${raw} × ${this.data.customCols || '?'} · 自定义` : '自定义行列', error: '' });
  },

  setCustomCols(event) {
    const raw = String(event.detail.value || '').replace(/[^\d]/g, '').slice(0, 2);
    this.setData({ preset: 'custom', customCols: raw, cols: Number(raw) || 0, gridLabel: `${this.data.customRows || '?'} × ${raw || '?'} · 自定义`, error: '' });
  },

  setFormat(event) {
    this.setData({ format: event.currentTarget.dataset.format });
  },

  onQuality(event) {
    this.setData({ quality: event.detail.value });
  },

  validateGrid() {
    const rows = Number(this.data.rows);
    const cols = Number(this.data.cols);
    const maxParts = service.MAX_SPLIT_PARTS || 100;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 10 || cols > 10 || rows * cols > maxParts) {
      this.setData({ error: `行列需在 1 至 10 之间，且总块数不超过 ${maxParts} 块` });
      wx.showToast({ title: '请输入有效的拆分行列', icon: 'none' });
      return null;
    }
    return { rows, cols };
  },

  startSplit() {
    if (!this.data.file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    const grid = this.validateGrid();
    if (!grid) return;
    this.setData({ state: 'processing', progress: 0, currentPart: '准备拆分', error: '' });
    track('tool_start', { tool: 'split', rows: grid.rows, cols: grid.cols });
    app.recordRecent({ key: 'split', title: '图片拆块', desc: '九宫格拆分，发布更有趣', icon: 'split', tone: 'purple', page: '/pages/split/split' });
    service.splitImage(this.data.file, { rows: grid.rows, cols: grid.cols, format: this.data.format, quality: this.data.quality }, this, progress => {
      this.setData({ progress: Math.round(progress.completed / progress.total * 100), currentPart: progress.current });
    }).then(results => {
      const baseName = fileBaseName(this.data.file.name);
      const displayResults = results.map((item, index) => ({
        ...item,
        name: `${baseName}-${pad(item.tileIndex || index + 1)}.${item.outputFormat || 'jpg'}`,
        sizeText: formatBytes(item.compressedBytes)
      }));
      const totalBytes = displayResults.reduce((sum, item) => sum + (Number(item.compressedBytes) || 0), 0);
      const gridLabel = `${grid.rows} × ${grid.cols}${grid.rows * grid.cols === 9 ? ' · 九宫格' : ''}`;
      this.setData({ state: 'success', progress: 100, currentPart: '', results: displayResults, resultCount: displayResults.length, gridLabel });
      app.recordOperation({ key: 'split', title: '图片拆块', desc: '九宫格拆分，发布更有趣', icon: 'split', tone: 'purple', page: '/pages/split/split', modeLabel: gridLabel, detailText: `${displayResults.length} 块 · ${formatBytes(totalBytes)}`, rows: grid.rows, cols: grid.cols, gridLabel, sourceWidth: this.data.file.width, sourceHeight: this.data.file.height, files: displayResults.map(item => ({ path: this.data.file.path, outputPath: item.outputPath, name: item.name, size: this.data.file.size, sizeText: this.data.file.sizeText, outputSize: item.compressedBytes, outputSizeText: formatBytes(item.compressedBytes), outputFormat: item.outputFormat, tileIndex: item.tileIndex, row: item.row, column: item.column, rows: item.rows, cols: item.cols, width: item.width, height: item.height })) }).catch(() => {});
      track('tool_success', { tool: 'split', count: displayResults.length });
    }).catch(error => {
      track('tool_error', { tool: 'split', reason: 'service_error' });
      this.setData({ state: 'error', error: error && error.message ? error.message : '图片拆分失败，请重新选择图片后重试' });
    });
  },

  previewResult(event) {
    const urls = this.data.results.filter(item => item.outputPath).map(item => item.outputPath);
    const current = this.data.results[event.currentTarget.dataset.index];
    if (!current || !current.outputPath || !urls.length) return;
    wx.previewImage({ current: current.outputPath, urls });
  },

  saveOne(item) {
    return new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: item.outputPath, success: resolve, fail: reject }));
  },

  saveResult(event) {
    const item = this.data.results[event.currentTarget.dataset.index];
    if (!item || !item.outputPath) return wx.showToast({ title: '当前结果没有可保存的文件', icon: 'none' });
    this.saveOne(item).then(() => wx.showToast({ title: '已保存到相册' })).catch(() => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false }));
  },

  saveAll() {
    const items = this.data.results.filter(item => item.outputPath);
    if (!items.length) return wx.showToast({ title: '当前没有可保存的结果', icon: 'none' });
    Promise.all(items.map(item => this.saveOne(item))).then(() => wx.showToast({ title: `已保存 ${items.length} 张图片` })).catch(() => wx.showModal({ title: '保存失败', content: '部分图片保存失败，请检查相册权限后重试。', showCancel: false }));
  },

  chooseAgain() {
    this.historyRecordId = '';
    this.restoredHistoryRecordId = '';
    this.setData({ file: null, state: 'empty', progress: 0, currentPart: '', resultCount: 0, results: [], error: '' });
    this.chooseImage();
  },

  retry() {
    this.setData({ state: 'empty', error: '' });
    this.startSplit();
  },

  goHome() {
    wx.navigateBack({ delta: 1 });
  }
});
