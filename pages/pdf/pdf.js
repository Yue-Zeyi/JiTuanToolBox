const app = getApp();
const service = require('../../services/tool-service');
const { formatBytes } = require('../../utils/format');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const MAX_FILES = service.MAX_STITCH_IMAGES || 20;
const PAGE_SIZES = [
  { key: 'auto', title: '自动', desc: '按图片方向适配' },
  { key: 'a4', title: 'A4', desc: '标准打印纸' },
  { key: 'a5', title: 'A5', desc: '便携小纸张' },
  { key: 'letter', title: 'Letter', desc: '北美常用' },
  { key: 'custom', title: '自定义', desc: '输入纸张尺寸' }
];
const ORIENTATIONS = [{ key: 'auto', title: '自动' }, { key: 'portrait', title: '纵向' }, { key: 'landscape', title: '横向' }];
const FITS = [{ key: 'contain', title: '等比适配', desc: '完整显示图片' }, { key: 'cover', title: '铺满裁剪', desc: '铺满页面边缘' }, { key: 'stretch', title: '拉伸填满', desc: '不留白但会变形' }];
const MARGINS = [{ key: 'none', title: '无边距' }, { key: 'small', title: '小边距' }, { key: 'standard', title: '标准边距' }];
const fileExtension = value => { const match = String(value || '').match(/\.([a-z0-9]+)(?:[?#].*)?$/i); return match ? match[1].toLowerCase() : ''; };

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
    files: [], maxFiles: MAX_FILES,
    pageSizes: PAGE_SIZES, pageSize: 'auto', customWidth: '210', customHeight: '297',
    orientations: ORIENTATIONS, orientation: 'auto',
    fits: FITS, fit: 'contain', margins: MARGINS, margin: 'small',
    state: 'empty', progress: 0, currentStep: '', result: null, error: ''
  },

  onLoad(options) { this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : ''; },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() { return getShareAppMessage({ path: '/pages/pdf/pdf' }); },
  onShareTimeline() { return getShareTimeline(); },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record) return;
    const sourceFiles = Array.isArray(record.files) ? record.files.map((item, index) => ({ ...item, path: item.path || '', name: item.name || `图片${index + 1}`, sizeText: item.sizeText || formatBytes(item.size || 0) })) : [];
    const outputPath = (sourceFiles[0] && sourceFiles[0].outputPath) || record.outputPath || '';
    const result = record.result || { name: record.name || '极团工具箱.pdf', count: record.fileCount || sourceFiles.length, size: record.outputSize || 0, outputPath };
    if (!outputPath && !result.outputPath) return;
    this.restoredHistoryRecordId = recordId;
    this.setData({ files: sourceFiles, pageSize: record.pageSize || 'auto', orientation: record.orientation || 'auto', fit: record.fit || 'contain', margin: record.margin || 'small', state: 'success', progress: 100, result: { ...result, outputPath: outputPath || result.outputPath, pageCount: result.pageCount || result.count || sourceFiles.length, sizeText: result.sizeText || formatBytes(result.size || record.outputSize || 0) }, error: '' });
  },

  async chooseImages() {
    if (this.data.state === 'processing') return;
    if (!await requestConsent()) return;
    const remaining = MAX_FILES - this.data.files.length;
    if (remaining <= 0) return wx.showToast({ title: `最多选择 ${MAX_FILES} 张图片`, icon: 'none' });
    const onSuccess = async response => {
      const rawFiles = response && response.tempFiles && response.tempFiles.length ? response.tempFiles : ((response && response.tempFilePaths) || []);
      if (!rawFiles.length) return wx.showToast({ title: '没有选择图片，请重试', icon: 'none' });
      const existing = this.data.files.map(item => item.path);
      const candidates = rawFiles.map((item, index) => {
        const path = typeof item === 'string' ? item : item && (item.tempFilePath || item.path || '');
        const name = typeof item === 'object' && item && item.name ? item.name : `图片${this.data.files.length + index + 1}.${fileExtension(path) || 'jpg'}`;
        return { path, name, size: typeof item === 'object' && item ? Number(item.size) || 0 : 0, type: typeof item === 'object' && item ? String(item.type || '').toLowerCase() : '' };
      }).filter(item => item.path && existing.indexOf(item.path) === -1).slice(0, remaining);
      const maxBytes = service.MAX_IMAGE_BYTES || 20 * 1024 * 1024;
      const accepted = [];
      let rejected = 0;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const size = await readFileInfo(candidate.path) || candidate.size;
        if (size > maxBytes) { rejected += 1; continue; }
        const info = await readImageInfo(candidate.path);
        const infoType = String(info && info.type || candidate.type || '').toLowerCase();
        const ext = fileExtension(candidate.name || candidate.path) || infoType.replace(/^image\//, '');
        if (ext && service.SUPPORTED_IMAGE_EXTENSIONS.indexOf(ext) === -1) { rejected += 1; continue; }
        if (info && (!Number(info.width) || !Number(info.height))) { rejected += 1; continue; }
        accepted.push({ path: candidate.path, name: candidate.name, size, sizeText: formatBytes(size), type: infoType, width: Number(info && info.width) || 0, height: Number(info && info.height) || 0 });
      }
      if (!accepted.length) return wx.showToast({ title: rejected ? '图片格式或大小不符合要求' : '没有可添加的图片', icon: 'none' });
      try {
        await checkSelectedImages(accepted);
      } catch (error) {
        return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
      }
      this.historyRecordId = ''; this.restoredHistoryRecordId = '';
      const files = this.data.files.concat(accepted);
      this.setData({ files, state: 'empty', result: null, progress: 0, currentStep: '', error: '' });
      if (rejected) wx.showToast({ title: `已添加 ${accepted.length} 张，${rejected} 张未添加`, icon: 'none', duration: 2200 });
    };
    const onFail = error => {
      const reason = error && error.errMsg ? error.errMsg : '';
      if (/privacy|隐私/i.test(reason)) return wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      if (/auth|permission|权限/i.test(reason)) return wx.showToast({ title: '请在手机设置中允许访问相册', icon: 'none' });
      wx.showToast({ title: '未能打开本地图片，请重试', icon: 'none' });
    };
    const count = Math.min(9, remaining);
    if (typeof wx.chooseImage === 'function') wx.chooseImage({ count, sizeType: ['original'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    else if (typeof wx.chooseMedia === 'function') wx.chooseMedia({ count, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    else onFail();
  },

  previewImage(event) {
    const current = this.data.files[Number(event.currentTarget.dataset.index)];
    const urls = this.data.files.map(item => item.path).filter(Boolean);
    if (current && current.path && urls.length) wx.previewImage({ current: current.path, urls });
  },

  removeFile(event) {
    if (this.data.state === 'processing') return;
    const files = this.data.files.slice(); files.splice(Number(event.currentTarget.dataset.index), 1);
    this.setData({ files, state: 'empty', result: null, error: '' });
  },

  clearFiles() { if (this.data.state === 'processing') return; this.setData({ files: [], state: 'empty', result: null, error: '' }); },

  moveFile(event) {
    if (this.data.state === 'processing') return;
    const index = Number(event.currentTarget.dataset.index); const delta = Number(event.currentTarget.dataset.delta); const next = index + delta;
    if (next < 0 || next >= this.data.files.length) return;
    const files = this.data.files.slice(); const item = files.splice(index, 1)[0]; files.splice(next, 0, item); this.setData({ files, state: 'empty', result: null });
  },

  setPageSize(event) { if (this.data.state === 'processing') return; this.setData({ pageSize: event.currentTarget.dataset.value, state: 'empty', result: null, error: '' }); },
  setOrientation(event) { if (this.data.state === 'processing') return; this.setData({ orientation: event.currentTarget.dataset.value, state: 'empty', result: null }); },
  setFit(event) { if (this.data.state === 'processing') return; this.setData({ fit: event.currentTarget.dataset.value, state: 'empty', result: null }); },
  setMargin(event) { if (this.data.state === 'processing') return; this.setData({ margin: event.currentTarget.dataset.value, state: 'empty', result: null }); },
  onCustomWidth(event) { if (this.data.state === 'processing') return; this.setData({ customWidth: String(event.detail.value || '').replace(/[^\d.]/g, '').slice(0, 6), state: 'empty', result: null }); },
  onCustomHeight(event) { if (this.data.state === 'processing') return; this.setData({ customHeight: String(event.detail.value || '').replace(/[^\d.]/g, '').slice(0, 6), state: 'empty', result: null }); },

  validate() {
    if (!this.data.files.length) { this.setData({ error: '请先选择至少 1 张图片' }); wx.showToast({ title: '请先选择图片', icon: 'none' }); return null; }
    const width = Number(this.data.customWidth); const height = Number(this.data.customHeight);
    if (this.data.pageSize === 'custom' && (!width || !height || width < 50 || height < 50 || width > 500 || height > 500)) { this.setData({ error: '自定义纸张尺寸需在 50–500 mm 之间' }); wx.showToast({ title: '请输入有效的纸张尺寸', icon: 'none' }); return null; }
    return { pageSize: this.data.pageSize, orientation: this.data.orientation, fit: this.data.fit, margin: this.data.margin, customWidth: width, customHeight: height };
  },

  startPdf() {
    const options = this.validate(); if (!options) return;
    this.setData({ state: 'processing', progress: 0, currentStep: '准备生成 PDF', error: '' });
    track('tool_start', { tool: 'pdf', count: this.data.files.length });
    app.recordRecent({ key: 'pdf', title: '图片转 PDF', desc: '多图合并成 PDF 文件', icon: 'pdf', tone: 'orange', page: '/pages/pdf/pdf' });
    service.imagesToPdf(this.data.files, options, this, progress => {
      const percent = progress && progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
      this.setData({ progress: Math.max(0, Math.min(100, percent)), currentStep: progress.current || '正在生成 PDF' });
    }).then(result => {
      const resultView = { ...result, sizeText: formatBytes(result.size), outputPath: result.outputPath || result.url, pageCount: result.count };
      this.setData({ state: 'success', progress: 100, currentStep: '', result: resultView });
      app.recordOperation({ key: 'pdf', title: '图片转 PDF', desc: '多图合并成 PDF 文件', icon: 'pdf', tone: 'orange', page: '/pages/pdf/pdf', pageSize: options.pageSize, orientation: options.orientation, fit: options.fit, margin: options.margin, name: result.name, outputPath: resultView.outputPath, outputSize: result.size, modeLabel: `${result.count} 页 · ${resultView.sizeText}`, detailText: `${result.count} 张图片 · ${resultView.sizeText}`, result: resultView, files: this.data.files.map(file => ({ ...file, outputPath: resultView.outputPath, outputSize: result.size, outputFormat: 'pdf' })) }).catch(() => {});
      track('tool_success', { tool: 'pdf', count: result.count });
    }).catch(error => { track('tool_error', { tool: 'pdf', reason: 'local_error' }); this.setData({ state: 'error', error: error && error.message ? error.message : 'PDF 生成失败，请重新选择图片后重试' }); });
  },

  savePdf() {
    const result = this.data.result;
    if (!result || !result.outputPath) return wx.showToast({ title: '当前没有可打开的 PDF', icon: 'none' });
    wx.openDocument({ filePath: result.outputPath, fileType: 'pdf', showMenu: true, success: () => track('result_save', { tool: 'pdf' }), fail: () => wx.showToast({ title: 'PDF 打开失败，请重试', icon: 'none' }) });
  },

  chooseAgain() { this.historyRecordId = ''; this.restoredHistoryRecordId = ''; this.setData({ files: [], state: 'empty', progress: 0, currentStep: '', result: null, error: '' }); this.chooseImages(); },
  retry() { this.startPdf(); }
});
