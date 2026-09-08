const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MAX_FILES = service.MAX_STITCH_IMAGES || 20;
const LAYOUT_OPTIONS = [
  { key: 'vertical', title: '竖向长图', desc: '从上到下拼接' },
  { key: 'horizontal', title: '横向拼图', desc: '从左到右拼接' },
  { key: 'grid', title: '网格拼接', desc: '整齐排列图片' }
];
const GAP_OPTIONS = [
  { key: 0, title: '无间距' },
  { key: 8, title: '8 px' },
  { key: 16, title: '16 px' },
  { key: 24, title: '24 px' }
];
const BACKGROUND_OPTIONS = [
  { key: 'white', title: '白色' },
  { key: 'light', title: '浅灰' },
  { key: 'dark', title: '深色' },
  { key: 'transparent', title: '透明' }
];
const DEFAULT_GRID_COLUMNS = 2;

const clampGridColumns = (value, max) => {
  const upper = Math.max(1, Math.round(Number(max) || 1));
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return Math.min(DEFAULT_GRID_COLUMNS, upper);
  return Math.max(1, Math.min(upper, numeric));
};

const getLabel = (items, key, fallback) => {
  const item = items.find(option => String(option.key) === String(key));
  return item ? item.title : fallback;
};
const layoutLabel = key => getLabel(LAYOUT_OPTIONS, key, '竖向长图');
const gapLabel = key => getLabel(GAP_OPTIONS, key, '16 px');
const backgroundLabel = key => getLabel(BACKGROUND_OPTIONS, key, '白色');
const fileExtension = value => {
  const match = String(value || '').match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? match[1].toLowerCase() : '';
};

function readFileInfo(path) {
  if (typeof wx.getFileInfo !== 'function') return Promise.resolve(0);
  return new Promise(resolve => wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || 0), fail: () => resolve(0) }));
}

function readImageInfo(path, fallback = {}) {
  if (typeof wx.getImageInfo !== 'function') return Promise.resolve(fallback);
  return new Promise(resolve => wx.getImageInfo({ src: path, success: resolve, fail: () => resolve(null) }));
}

Page({
  data: {
    files: [],
    maxFiles: MAX_FILES,
    layoutOptions: LAYOUT_OPTIONS,
    layout: 'vertical',
    layoutLabel: layoutLabel('vertical'),
    gridColumns: DEFAULT_GRID_COLUMNS,
    gridColumnsInput: String(DEFAULT_GRID_COLUMNS),
    gridColumnsMax: DEFAULT_GRID_COLUMNS,
    gapOptions: GAP_OPTIONS,
    gap: 16,
    gapLabel: gapLabel(16),
    backgroundOptions: BACKGROUND_OPTIONS,
    background: 'white',
    backgroundLabel: backgroundLabel('white'),
    format: 'auto',
    quality: 88,
    state: 'empty',
    progress: 0,
    currentStep: '',
    result: null,
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
    return getShareAppMessage({ path: '/pages/stitch/stitch' });
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
    const outputPath = record.previewPath || first.outputPath || first.path || '';
    if (!outputPath) return;
    const sourceFiles = record.files.map((item, index) => ({
      ...item,
      path: item.path || outputPath,
      name: item.name || `图片${index + 1}`,
      size: Number(item.size) || 0,
      sizeText: item.sizeText || formatBytes(Number(item.size) || 0),
      previewFailed: false
    }));
    const outputFormat = record.outputFormat || first.outputFormat || fileExtension(outputPath) || 'jpg';
    const originalBytes = Number(record.originalBytes) || sourceFiles.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    const compressedBytes = Number(record.outputSize) || Number(first.outputSize) || originalBytes;
    const layout = record.layoutMode || 'vertical';
    const gap = Number.isFinite(Number(record.gap)) ? Number(record.gap) : 16;
    const background = BACKGROUND_OPTIONS.some(item => item.key === record.background) ? record.background : 'white';
    const gridColumns = Number(record.gridColumns || record.cols) || DEFAULT_GRID_COLUMNS;
    const gridColumnsMax = Math.max(1, sourceFiles.length);
    const safeGridColumns = clampGridColumns(gridColumns, gridColumnsMax);
    this.restoredHistoryRecordId = recordId;
    this.setData({
      files: sourceFiles,
      layout,
      layoutLabel: record.layoutLabel || layoutLabel(layout),
      gridColumns: safeGridColumns,
      gridColumnsInput: String(safeGridColumns),
      gridColumnsMax,
      gap,
      gapLabel: record.gapLabel || gapLabel(gap),
      background,
      backgroundLabel: record.backgroundLabel || backgroundLabel(background),
      format: outputFormat === 'png' ? 'png' : (outputFormat === 'jpg' ? 'jpg' : 'auto'),
      state: 'success',
      progress: 100,
      currentStep: '',
      error: '',
      result: {
        outputPath,
        outputFormat,
        formatLabel: outputFormat.toUpperCase(),
        width: Number(record.outputWidth) || Number(first.outputWidth) || Number(first.width) || 0,
        height: Number(record.outputHeight) || Number(first.outputHeight) || Number(first.height) || 0,
        originalBytes,
        compressedBytes,
        originalText: formatBytes(originalBytes),
        sizeText: formatBytes(compressedBytes),
        fileCount: Number(record.fileCount) || sourceFiles.length,
        layoutLabel: record.layoutLabel || layoutLabel(layout),
        gapLabel: record.gapLabel || gapLabel(gap),
        backgroundLabel: record.backgroundLabel || backgroundLabel(background)
      }
    });
  },

  async chooseImages() {
    if (this.data.state === 'processing') return;
    if (!await requestConsent()) return;
    const remaining = MAX_FILES - this.data.files.length;
    if (remaining <= 0) return wx.showToast({ title: `最多选择 ${MAX_FILES} 张图片`, icon: 'none' });
    const onSuccess = async response => {
      const rawFiles = response && response.tempFiles && response.tempFiles.length
        ? response.tempFiles
        : ((response && response.tempFilePaths) || []);
      if (!rawFiles.length) return wx.showToast({ title: '没有选择图片，请重试', icon: 'none' });
      const existingPaths = this.data.files.map(file => file.path);
      const candidates = rawFiles.map((item, index) => {
        const path = typeof item === 'string' ? item : item && (item.tempFilePath || item.path || '');
        const type = typeof item === 'object' && item ? String(item.type || item.fileType || '').toLowerCase() : '';
        const ext = fileExtension((typeof item === 'object' && item && item.name) || path) || type.replace(/^image\//, '');
        return {
          path,
          name: (typeof item === 'object' && item && item.name) || `图片${this.data.files.length + index + 1}.${ext || 'jpg'}`,
          size: typeof item === 'object' && item ? Number(item.size) || 0 : 0,
          type,
          ext
        };
      }).filter(item => item.path && existingPaths.indexOf(item.path) === -1);
      const results = await Promise.all(candidates.map(async candidate => {
        const size = await readFileInfo(candidate.path);
        const imageInfo = await readImageInfo(candidate.path, candidate);
        if (!imageInfo || !Number(imageInfo.width) || !Number(imageInfo.height)) return { candidate, reason: 'invalid' };
        const infoType = String(imageInfo.type || candidate.type || '').toLowerCase();
        const ext = candidate.ext || infoType.replace(/^image\//, '');
        if (ext && service.SUPPORTED_IMAGE_EXTENSIONS.indexOf(ext) === -1) return { candidate, reason: 'format' };
        return {
          file: {
            path: candidate.path,
            name: candidate.name,
            size: size || candidate.size,
            sizeText: formatBytes(size || candidate.size),
            type: infoType,
            width: Number(imageInfo.width),
            height: Number(imageInfo.height),
            previewFailed: false
          }
        };
      }));
      const maxBytes = service.MAX_IMAGE_BYTES || 20 * 1024 * 1024;
      const oversized = results.filter(item => item.file && Number(item.file.size) > maxBytes).length;
      const unsupported = results.filter(item => item.reason === 'format').length;
      const invalid = results.filter(item => item.reason === 'invalid').length;
      const accepted = results.filter(item => item.file && Number(item.file.size) <= maxBytes).map(item => item.file).slice(0, remaining);
      if (!accepted.length) {
        const reason = oversized ? '图片不能超过 20MB' : (unsupported ? '当前图片格式暂不支持' : (invalid ? '无法读取图片，请重新选择' : '没有可添加的图片'));
        return wx.showToast({ title: reason, icon: 'none' });
      }
      try {
        await checkSelectedImages(accepted);
      } catch (error) {
        return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
      }
      this.historyRecordId = '';
      this.restoredHistoryRecordId = '';
      const previousCount = this.data.files.length;
      const files = this.data.files.concat(accepted);
      const gridColumnsMax = Math.max(1, files.length);
      const defaultGridColumns = previousCount < 2 && files.length >= 2 ? DEFAULT_GRID_COLUMNS : this.data.gridColumns;
      const gridColumns = clampGridColumns(defaultGridColumns, gridColumnsMax);
      this.setData({ files, gridColumns, gridColumnsInput: String(gridColumns), gridColumnsMax, state: 'empty', result: null, progress: 0, currentStep: '', error: '' });
      const ignored = oversized + unsupported + invalid + Math.max(0, results.filter(item => item.file).length - accepted.length - oversized);
      if (ignored) wx.showToast({ title: `已添加 ${accepted.length} 张，${ignored} 张未添加`, icon: 'none', duration: 2200 });
    };
    const onFail = error => {
      const reason = error && error.errMsg ? error.errMsg : '';
      if (/privacy|隐私/i.test(reason)) return wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      if (/auth|permission|权限/i.test(reason)) return wx.showToast({ title: '请在手机设置中允许访问相册', icon: 'none' });
      wx.showToast({ title: '未能打开本地图片，请重试', icon: 'none' });
    };
    const batchCount = Math.min(remaining, 9);
    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: batchCount, sizeType: ['original', 'compressed'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: batchCount, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
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
    files.splice(Number(event.currentTarget.dataset.index), 1);
    const gridColumnsMax = Math.max(1, files.length || DEFAULT_GRID_COLUMNS);
    const gridColumns = clampGridColumns(this.data.gridColumns, gridColumnsMax);
    this.setData({ files, gridColumns, gridColumnsInput: String(gridColumns), gridColumnsMax, state: 'empty', result: null, error: '' });
  },

  setLayout(event) {
    if (this.data.state === 'processing') return;
    const layout = event.currentTarget.dataset.layout;
    if (!LAYOUT_OPTIONS.some(item => item.key === layout)) return;
    this.setData({ layout, layoutLabel: layoutLabel(layout), state: 'empty', result: null, error: '' });
  },

  setGridColumns(event) {
    if (this.data.state === 'processing') return;
    const delta = Number(event.currentTarget.dataset.delta);
    if (!Number.isFinite(delta) || !delta) return;
    const gridColumns = clampGridColumns(this.data.gridColumns + delta, this.data.gridColumnsMax);
    this.setData({ gridColumns, gridColumnsInput: String(gridColumns), state: 'empty', result: null, error: '' });
  },

  onGridColumnsInput(event) {
    if (this.data.state === 'processing') return;
    const raw = String(event.detail.value || '').replace(/[^\d]/g, '').slice(0, 2);
    if (!raw) return this.setData({ gridColumnsInput: '', state: 'empty', result: null, error: '' });
    const gridColumns = clampGridColumns(raw, this.data.gridColumnsMax);
    this.setData({ gridColumns, gridColumnsInput: String(gridColumns), state: 'empty', result: null, error: '' });
  },

  onGridColumnsBlur() {
    if (this.data.state === 'processing') return;
    const gridColumns = clampGridColumns(this.data.gridColumnsInput, this.data.gridColumnsMax);
    this.setData({ gridColumns, gridColumnsInput: String(gridColumns), error: '' });
  },

  setGap(event) {
    if (this.data.state === 'processing') return;
    const gap = Number(event.currentTarget.dataset.gap);
    if (!GAP_OPTIONS.some(item => item.key === gap)) return;
    this.setData({ gap, gapLabel: gapLabel(gap), state: 'empty', result: null });
  },

  setBackground(event) {
    if (this.data.state === 'processing') return;
    const background = event.currentTarget.dataset.background;
    if (!BACKGROUND_OPTIONS.some(item => item.key === background)) return;
    this.setData({ background, backgroundLabel: backgroundLabel(background), format: background === 'transparent' ? 'png' : this.data.format, state: 'empty', result: null });
  },

  setFormat(event) {
    if (this.data.state === 'processing') return;
    const format = event.currentTarget.dataset.format;
    if (['auto', 'jpg', 'png'].indexOf(format) === -1) return;
    const resetTransparent = format !== 'png' && this.data.background === 'transparent';
    this.setData({ format, background: resetTransparent ? 'white' : this.data.background, backgroundLabel: resetTransparent ? backgroundLabel('white') : this.data.backgroundLabel, state: 'empty', result: null });
  },

  onQuality(event) {
    if (this.data.state === 'processing') return;
    this.setData({ quality: event.detail.value, state: 'empty', result: null });
  },

  validate() {
    if (this.data.files.length < 2) {
      this.setData({ error: '请至少选择 2 张图片再开始拼接' });
      wx.showToast({ title: '请至少选择 2 张图片', icon: 'none' });
      return null;
    }
    if (this.data.files.length > MAX_FILES) {
      this.setData({ error: `最多选择 ${MAX_FILES} 张图片` });
      wx.showToast({ title: `最多选择 ${MAX_FILES} 张图片`, icon: 'none' });
      return null;
    }
    const gridColumnsMax = Math.max(1, this.data.files.length);
    const gridCols = clampGridColumns(this.data.gridColumnsInput, gridColumnsMax);
    this.setData({ gridColumns: gridCols, gridColumnsInput: String(gridCols), gridColumnsMax });
    return { mode: this.data.layout, gridCols, fileCount: this.data.files.length, gap: this.data.gap, background: this.data.background, format: this.data.format, quality: this.data.quality };
  },

  startStitch() {
    const options = this.validate();
    if (!options) return;
    this.setData({ state: 'processing', progress: 0, currentStep: '准备拼接', error: '' });
    track('tool_start', { tool: 'stitch', count: this.data.files.length, mode: options.mode });
    app.recordRecent({ key: 'stitch', title: '图片拼接', desc: '长图横图拼接，自定义布局', icon: 'stitch', tone: 'orange', page: '/pages/stitch/stitch' });
    service.stitchImages(this.data.files, options, this, progress => {
      const percent = progress && progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
      this.setData({ progress: Math.max(0, Math.min(100, percent)), currentStep: progress.current || '正在拼接图片' });
    }).then(result => {
      const outputFormat = result.outputFormat || 'jpg';
      const resultView = {
        ...result,
        formatLabel: outputFormat.toUpperCase(),
        originalText: formatBytes(result.originalBytes),
        sizeText: formatBytes(result.compressedBytes),
        layoutLabel: layoutLabel(options.mode),
        gapLabel: gapLabel(options.gap),
        backgroundLabel: backgroundLabel(options.background)
      };
      this.setData({ state: 'success', progress: 100, currentStep: '', result: resultView });
      const outputSizeText = formatBytes(result.compressedBytes);
      app.recordOperation({
        key: 'stitch',
        title: '图片拼接',
        desc: '长图横图拼接，自定义布局',
        icon: 'stitch',
        tone: 'orange',
        page: '/pages/stitch/stitch',
        modeLabel: `${layoutLabel(options.mode)} · ${gapLabel(options.gap)}`,
        layoutMode: options.mode,
        layoutLabel: layoutLabel(options.mode),
        gridColumns: result.cols || options.gridCols,
        gap: options.gap,
        gapLabel: gapLabel(options.gap),
        background: options.background,
        backgroundLabel: backgroundLabel(options.background),
        outputFormat,
        outputWidth: result.width,
        outputHeight: result.height,
        originalBytes: result.originalBytes,
        outputSize: result.compressedBytes,
        detailText: `${this.data.files.length} 张图片 · ${result.width} × ${result.height} px`,
        files: this.data.files.map(file => ({
          path: file.path,
          outputPath: result.outputPath,
          name: file.name,
          size: file.size,
          sizeText: file.sizeText,
          width: file.width,
          height: file.height,
          outputSize: result.compressedBytes,
          outputSizeText,
          outputFormat,
          outputWidth: result.width,
          outputHeight: result.height
        }))
      }).catch(() => {});
      track('tool_success', { tool: 'stitch', count: this.data.files.length, mode: options.mode });
    }).catch(error => {
      track('tool_error', { tool: 'stitch', reason: 'service_error' });
      this.setData({ state: 'error', error: error && error.message ? error.message : '图片拼接失败，请重新选择图片后重试' });
    });
  },

  previewResult() {
    const result = this.data.result;
    if (!result || !result.outputPath) return;
    wx.previewImage({ current: result.outputPath, urls: [result.outputPath] });
  },

  saveResult() {
    const result = this.data.result;
    if (!result || !result.outputPath) return wx.showToast({ title: '当前没有可保存的结果', icon: 'none' });
    wx.saveImageToPhotosAlbum({
      filePath: result.outputPath,
      success: () => { track('result_save', { tool: 'stitch' }); wx.showToast({ title: '已保存到相册' }); },
      fail: () => wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存图片到相册。', showCancel: false })
    });
  },

  chooseAgain() {
    this.historyRecordId = '';
    this.restoredHistoryRecordId = '';
    this.setData({ files: [], gridColumns: DEFAULT_GRID_COLUMNS, gridColumnsInput: String(DEFAULT_GRID_COLUMNS), gridColumnsMax: DEFAULT_GRID_COLUMNS, state: 'empty', progress: 0, currentStep: '', result: null, error: '' });
    this.chooseImages();
  },

  retry() {
    this.setData({ state: 'empty', error: '' });
    this.startStitch();
  },

  goHome() {
    wx.navigateBack({ delta: 1 });
  }
});
