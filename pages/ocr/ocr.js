const app = getApp();
const service = require('../../services/tool-service');
const { requestConsent } = require('../../utils/privacy');
const { checkSelectedImages } = require('../../utils/content-security');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: { file: null, state: 'empty', text: '', error: '' },

  onLoad(options) {
    this.historyRecordId = options && options.recordId ? decodeURIComponent(options.recordId) : '';
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
    this.restoreHistoryRecord();
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/ocr/ocr' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  restoreHistoryRecord() {
    const recordId = this.historyRecordId;
    if (!recordId || this.restoredHistoryRecordId === recordId) return;
    const record = app.getOperationRecord(recordId);
    if (!record || typeof record.text !== 'string' || !record.text) return;
    const source = Array.isArray(record.files) && record.files[0] ? record.files[0] : null;
    this.restoredHistoryRecordId = recordId;
    this.setData({
      file: source,
      text: record.text,
      state: 'success',
      error: ''
    });
  },

  async chooseImage() {
    if (!await requestConsent()) return;
    const onSuccess = async result => {
      const item = (result.tempFiles || result.tempFilePaths || [])[0];
      const path = typeof item === 'string' ? item : item && (item.tempFilePath || item.path);
      if (!path) return;
      let size = typeof item === 'string' ? 0 : (item.size || 0);
      if (typeof wx.getFileInfo === 'function') {
        size = await new Promise(resolve => wx.getFileInfo({ filePath: path, success: info => resolve(Number(info && info.size) || size), fail: () => resolve(size) }));
      }
      if (Number(size) > (service.MAX_IMAGE_BYTES || 20 * 1024 * 1024)) return wx.showToast({ title: '图片超过 20MB', icon: 'none' });
      const file = { path, size, name: '待识别图片' };
      try {
        await checkSelectedImages([file]);
      } catch (error) {
        return wx.showToast({ title: error && error.message ? error.message : '内容安全检测失败，请稍后重试', icon: 'none', duration: 2600 });
      }
      this.setData({ file, state: 'empty', text: '', error: '' });
    };
    const onFail = () => wx.showToast({ title: '未能打开本地图片，请检查相册权限', icon: 'none' });
    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({ count: 1, sizeType: ['original', 'compressed'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: onSuccess, fail: onFail });
    } else onFail();
  },

  startOcr() {
    if (!this.data.file) return wx.showToast({ title: '请先选择图片', icon: 'none' });
    this.setData({ state: 'processing' });
    track('tool_start', { tool: 'ocr' });
    app.recordRecent({ key: 'ocr', title: '图片转文字', desc: '从截图和照片中提取文字', icon: 'ocr', tone: 'purple', page: '/pages/ocr/ocr' });
    service.recognizeImage(this.data.file).then(result => { this.setData({ state: 'success', text: result.text }); app.recordOperation({ key: 'ocr', title: '图片转文字', desc: '从截图和照片中提取文字', icon: 'ocr', tone: 'purple', page: '/pages/ocr/ocr', modeLabel: '本次识别结果', detailText: `识别出 ${String(result.text || '').length} 个字符`, text: result.text || '', files: [{ path: this.data.file.path, name: this.data.file.name, size: this.data.file.size, sizeText: this.data.file.size ? `${Math.round(this.data.file.size / 1024)} KB` : '' }] }).catch(() => {}); track('tool_success', { tool: 'ocr' }); }).catch(() => { track('tool_error', { tool: 'ocr', reason: 'service_error' }); this.setData({ state: 'error', error: '识别服务暂时不可用，请稍后重试。' }); });
  },

  copyText() { wx.setClipboardData({ data: this.data.text }).then(() => { track('result_copy', { tool: 'ocr' }); wx.showToast({ title: '已复制全部文字' }); }); },
  retry() { this.startOcr(); }
});
