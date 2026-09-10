const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { MAX_TEXT_LENGTH, ERROR_LEVELS, SIZES, buildQrContent, createQrMatrix, getQrLayout } = require('../../utils/qrcode');
const { outputName, saveNamedImageToAlbum } = require('../../utils/image-output');

const TOOL = { key: 'qrcode', title: '二维码生成', desc: '将文字或网址生成二维码', icon: 'qrcode', tone: 'blue', page: '/pages/qrcode/qrcode' };

Page({
  data: {
    maxLength: MAX_TEXT_LENGTH,
    inputText: '',
    inputCount: 0,
    mode: 'text',
    encodedText: '',
    sizes: SIZES,
    size: 512,
    levels: ERROR_LEVELS,
    level: 'M',
    hasResult: false,
    imagePath: '',
    outputName: '',
    showCanvas: false,
    rendering: false,
    saving: false,
    saved: false,
    error: ''
  },

  onLoad(options = {}) {
    this.unloaded = false;
    this._revision = 0;
    this.qrMatrix = null;
    this.qrFilePath = '';
    if (!options.recordId) return;
    let record;
    try {
      record = app.getOperationRecord(decodeURIComponent(options.recordId));
    } catch (error) {
      wx.showToast({ title: '记录不存在或图片已清理', icon: 'none' });
      return;
    }
    const input = record && record.qrInput;
    const file = record && Array.isArray(record.files) ? record.files[0] : null;
    const imagePath = record && [record.previewPath, file && file.outputPath, file && file.path].find(value => typeof value === 'string' && value.trim());
    const inputLength = input && typeof input.text === 'string' ? Array.from(input.text).length : -1;
    if (!record || record.key !== TOOL.key || !input || inputLength < 1 || inputLength > MAX_TEXT_LENGTH || !SIZES.includes(Number(input.size)) || !ERROR_LEVELS.includes(input.level) || !imagePath) {
      wx.showToast({ title: '记录不存在或图片已清理', icon: 'none' });
      return;
    }
    this.qrFilePath = imagePath;
    const mode = ['text', 'link'].includes(input.mode) ? input.mode : (/^https?:\/\//i.test(input.text.trim()) ? 'link' : 'text');
    const payload = typeof input.payload === 'string' ? input.payload : input.text;
    this._resultInput = { text: input.text, size: Number(input.size), level: input.level, mode, payload };
    this.setData({ mode, encodedText: payload, inputText: input.text, inputCount: inputLength, size: Number(input.size), level: input.level, imagePath, outputName: (file && (file.outputName || file.name)) || outputName('jituan-qrcode', 'png'), hasResult: true, saved: true });
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onUnload() {
    this.unloaded = true;
    this._revision += 1;
  },

  invalidate(patch = {}) {
    this._revision += 1;
    this.qrMatrix = null;
    this.qrFilePath = '';
    this._resultInput = null;
    this.setData({ ...patch, hasResult: false, imagePath: '', outputName: '', encodedText: '', showCanvas: false, rendering: false, saving: false, error: '', saved: false });
  },

  onTextInput(event) {
    const inputText = String(event && event.detail ? event.detail.value || '' : '');
    this.invalidate({ inputText, inputCount: Array.from(inputText).length });
  },

  selectSize(event) {
    const size = Number(event.currentTarget.dataset.value);
    if (SIZES.includes(size)) this.invalidate({ size });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (['text', 'link'].includes(mode) && mode !== this.data.mode) this.invalidate({ mode });
  },

  selectLevel(event) {
    const level = event.currentTarget.dataset.value;
    if (ERROR_LEVELS.includes(level)) this.invalidate({ level });
  },

  generate() {
    if (this.data.rendering || this.data.saving) return;
    if (!this.data.inputText.trim()) {
      const error = this.data.mode === 'link' ? '请先输入网页链接' : '请先输入文字内容';
      this.setData({ error });
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    this.qrMatrix = null;
    this.qrFilePath = '';
    this._resultInput = null;
    this.setData({ hasResult: false, imagePath: '', showCanvas: false, error: '', saved: false });
    try {
      const payload = buildQrContent(this.data.inputText, this.data.mode);
      const matrix = createQrMatrix(this.data.inputText, this.data.level, this.data.mode);
      this.qrMatrix = matrix;
      this._resultInput = { text: this.data.inputText, size: this.data.size, level: this.data.level, mode: this.data.mode, payload };
      this.setData({ encodedText: payload, showCanvas: true, rendering: true }, () => this.renderMatrix(matrix, this.data.size));
    } catch (error) {
      this.setData({ error: error.message || '二维码生成失败，请检查输入', rendering: false, showCanvas: false });
    }
  },

  renderMatrix(matrix, size) {
    if (typeof wx.createSelectorQuery !== 'function' || typeof wx.canvasToTempFilePath !== 'function') {
      this.setData({ rendering: false, showCanvas: false, error: '当前微信版本暂不支持二维码画布' });
      return;
    }
    const query = wx.createSelectorQuery();
    const scoped = typeof query.in === 'function' ? query.in(this) : query;
    scoped.select('#qrcodeCanvas').fields({ node: true, size: true }).exec(result => {
      const canvas = result && result[0] && result[0].node;
      if (this.unloaded || matrix !== this.qrMatrix) return;
      if (!canvas) return this.finishRenderError('二维码画布初始化失败');
      const layout = getQrLayout(matrix, size);
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, size, size);
      context.fillStyle = '#101820';
      const origin = layout.offset + layout.quietZone * layout.scale;
      matrix.modules.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
        if (dark) context.fillRect(origin + columnIndex * layout.scale, origin + rowIndex * layout.scale, layout.scale, layout.scale);
      }));
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: size,
        height: size,
        destWidth: size,
        destHeight: size,
        fileType: 'png',
        success: file => {
          if (this.unloaded || matrix !== this.qrMatrix) return;
          this.qrFilePath = file.tempFilePath;
          this.setData({ imagePath: file.tempFilePath, outputName: outputName('jituan-qrcode', 'png'), hasResult: true, showCanvas: false, rendering: false, error: '' });
        },
        fail: () => {
          if (!this.unloaded && matrix === this.qrMatrix) this.finishRenderError('二维码图片生成失败，请重试');
        }
      });
    });
  },

  finishRenderError(message) {
    if (this.unloaded) return;
    this.qrMatrix = null;
    this.qrFilePath = '';
    this._resultInput = null;
    this.setData({ hasResult: false, imagePath: '', showCanvas: false, rendering: false, error: message });
  },

  previewImage() {
    if (this.qrFilePath) wx.previewImage({ current: this.qrFilePath, urls: [this.qrFilePath] });
  },

  saveImage() {
    if (!this.qrFilePath || this.data.saving) return;
    this.saveImageToAlbum(true);
  },

  saveImageToAlbum(allowSettings) {
    saveNamedImageToAlbum(this.qrFilePath, 'jituan-qrcode', 'png', this.data.outputName).then(() => {
      wx.showToast({ title: '已保存到相册' });
    }).catch(error => {
        const denied = /auth deny|authorize:fail|permission/i.test(String(error && error.errMsg || ''));
        if (!denied || !allowSettings || typeof wx.openSetting !== 'function') {
          wx.showToast({ title: denied ? '请允许访问相册后重试' : '保存失败，请重试', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册。',
          confirmText: '去设置',
          success: result => {
            if (!result.confirm) return;
            wx.openSetting({ success: setting => {
              if (setting.authSetting && setting.authSetting['scope.writePhotosAlbum']) this.saveImageToAlbum(false);
            } });
          }
        });
    });
  },

  clearAll() {
    this.invalidate({ inputText: '', inputCount: 0 });
  },

  async saveRecord() {
    if (!this.data.hasResult || !this.qrFilePath || !this._resultInput || this.data.saving || this.data.saved) return;
    const revision = this._revision;
    const resultInput = { ...this._resultInput };
    const filePath = this.qrFilePath;
    const resultName = this.data.outputName || outputName('jituan-qrcode', 'png');
    this.setData({ saving: true });
    try {
      await app.recordOperation({
        ...TOOL,
        modeLabel: `${resultInput.mode === 'link' ? '链接' : '文字'} · ${resultInput.size}px · ${resultInput.level} 级纠错`,
        detailText: `${Array.from(resultInput.text).length} 个字符`,
        text: resultInput.text,
        qrInput: resultInput,
        files: [{ name: resultName, outputName: resultName, type: 'image', path: filePath, outputPath: filePath, outputFormat: 'png' }]
      });
      if (this.unloaded || revision !== this._revision) return;
      this.setData({ saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (error) {
      if (!this.unloaded && revision === this._revision) wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      if (!this.unloaded && revision === this._revision) this.setData({ saving: false });
    }
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL.page }); },
  onShareTimeline() { return getShareTimeline(); }
});
