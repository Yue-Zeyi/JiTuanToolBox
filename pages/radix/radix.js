const app = getApp();
const {
  COMMON_BASES,
  WIDTHS,
  isBigIntSupported,
  convert,
  convertCommon,
  twosComplement,
  divisionSteps,
  convertBatchAsync
} = require('../../utils/radix');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

const TOOL = { key: 'radix', title: '进制转换', desc: '精确转换整数、小数与补码', icon: 'radix', tone: 'orange', page: '/pages/radix/radix' };
const PRECISIONS = [64, 256, 1024, 2048];
const STEP_TEXT_BUDGET = 64 * 1024;
const INPUT_PLACEHOLDERS = { single: '例如：255、-1010.01', batch: '例如：\n255\n-10\n0.5' };
const STATUS_LABELS = { integer: '精确整数', terminating: '精确有限小数', repeating: '精确循环小数', truncated: '达到展开上限' };

function validBase(value) {
  const base = Number(value);
  return Number.isInteger(base) && base >= 2 && base <= 36 ? base : value;
}

Page({
  data: {
    mode: 'single',
    modes: [{ key: 'single', label: '单个转换' }, { key: 'batch', label: '批量转换' }],
    basePresets: COMMON_BASES,
    sourceBase: 10,
    targetBase: 16,
    input: '',
    inputPlaceholder: INPUT_PLACEHOLDERS.single,
    precisions: PRECISIONS,
    precisionIndex: 0,
    maxFractionDigits: PRECISIONS[0],
    widths: WIDTHS,
    widthIndex: 0,
    twosWidth: WIDTHS[0],
    processing: false,
    saving: false,
    saved: false,
    hasResult: false,
    error: '',
    result: null,
    statusLabel: '',
    commonResults: [],
    complement: null,
    complementError: '',
    steps: [],
    stepsLoaded: false,
    stepsOpen: false,
    stepsComplete: true,
    stepsNote: '',
    batchResult: null,
    resultText: ''
  },

  onLoad(options) {
    this.unloaded = false;
    if (!options || !options.recordId) return;
    let record;
    try {
      record = app.getOperationRecord(decodeURIComponent(options.recordId));
    } catch (error) {
      record = null;
    }
    const input = record && record.radixInput;
    if (!record || record.key !== TOOL.key || !input || !['single', 'batch'].includes(input.mode)) {
      wx.showToast({ title: '记录不存在或已清理', icon: 'none' });
      return;
    }
    const precisionIndex = PRECISIONS.indexOf(Number(input.maxFractionDigits));
    const widthIndex = WIDTHS.indexOf(Number(input.twosWidth));
    this.setData({
      mode: input.mode,
      input: String(input.input || ''),
      inputPlaceholder: INPUT_PLACEHOLDERS[input.mode],
      sourceBase: validBase(input.sourceBase),
      targetBase: validBase(input.targetBase),
      precisionIndex: precisionIndex < 0 ? 0 : precisionIndex,
      maxFractionDigits: precisionIndex < 0 ? PRECISIONS[0] : PRECISIONS[precisionIndex],
      widthIndex: widthIndex < 0 ? 0 : widthIndex,
      twosWidth: widthIndex < 0 ? WIDTHS[0] : WIDTHS[widthIndex]
    });
    this.convertNow();
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onUnload() {
    this.unloaded = true;
    this._runToken = (this._runToken || 0) + 1;
  },

  invalidate(patch) {
    this._runToken = (this._runToken || 0) + 1;
    this._savedSignature = '';
    this._resultInput = null;
    this.setData({
      ...(patch || {}),
      processing: false,
      saved: false,
      hasResult: false,
      error: '',
      result: null,
      statusLabel: '',
      commonResults: [],
      complement: null,
      complementError: '',
      steps: [],
      stepsLoaded: false,
      stepsOpen: false,
      stepsComplete: true,
      stepsNote: '',
      batchResult: null,
      resultText: ''
    });
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (['single', 'batch'].includes(mode) && mode !== this.data.mode) this.invalidate({ mode, inputPlaceholder: INPUT_PLACEHOLDERS[mode] });
  },

  onInput(event) {
    this.invalidate({ input: String(event.detail.value || '') });
  },

  chooseBase(event) {
    const base = validBase(event.currentTarget.dataset.base);
    if (event.currentTarget.dataset.role === 'source') this.invalidate({ sourceBase: base });
    else this.invalidate({ targetBase: base });
  },

  onSourceBaseChange(event) {
    this.invalidate({ sourceBase: validBase(event.detail.value) });
  },

  onTargetBaseChange(event) {
    this.invalidate({ targetBase: validBase(event.detail.value) });
  },

  onPrecisionChange(event) {
    const index = Number(event.detail.value);
    if (PRECISIONS[index]) this.invalidate({ precisionIndex: index, maxFractionDigits: PRECISIONS[index] });
  },

  onWidthChange(event) {
    const index = Number(event.detail.value);
    if (WIDTHS[index]) this.invalidate({ widthIndex: index, twosWidth: WIDTHS[index] });
  },

  currentInput() {
    return {
      mode: this.data.mode,
      input: this.data.input,
      sourceBase: Number(this.data.sourceBase),
      targetBase: Number(this.data.targetBase),
      maxFractionDigits: Number(this.data.maxFractionDigits),
      twosWidth: Number(this.data.twosWidth)
    };
  },

  async convertNow() {
    if (this.data.processing) return;
    const input = this.currentInput();
    const token = (this._runToken || 0) + 1;
    this._runToken = token;
    this.setData({ processing: true, saved: false, hasResult: false, error: '', result: null, commonResults: [], complement: null, complementError: '', steps: [], stepsLoaded: false, stepsOpen: false, stepsNote: '', batchResult: null, resultText: '' });
    try {
      if (!isBigIntSupported()) throw new Error('当前微信版本不支持精确大整数计算，请更新微信后重试');
      await new Promise(resolve => setTimeout(resolve, 0));
      if (this.unloaded || token !== this._runToken) return;
      const options = { maxFractionDigits: input.maxFractionDigits };
      if (input.mode === 'batch') {
        const batchResult = await convertBatchAsync(input.input, input.sourceBase, input.targetBase, { ...options, chunkSize: 10 });
        if (this.unloaded || token !== this._runToken) return;
        this._resultInput = input;
        this.setData({ hasResult: true, batchResult, resultText: batchResult.text });
      } else {
        const result = convert(input.input, input.sourceBase, input.targetBase, options);
        const commonResults = convertCommon(input.input, input.sourceBase, options);
        let complement = null;
        let complementError = '';
        try {
          complement = twosComplement(input.input, input.sourceBase, input.twosWidth);
        } catch (error) {
          complementError = error.message || '无法生成补码视图';
        }
        const resultText = [
          '进制转换',
          `源进制：${input.sourceBase}`,
          `目标进制：${input.targetBase}`,
          `输入：${input.input}`,
          `结果：${result.value}`,
          `状态：${STATUS_LABELS[result.status]}`,
          result.note,
          '',
          ...commonResults.map(item => `${item.base} 进制：${item.value}`)
        ].join('\n');
        this._resultInput = input;
        this.setData({
          hasResult: true,
          result,
          statusLabel: STATUS_LABELS[result.status],
          commonResults,
          complement,
          complementError,
          steps: [],
          stepsLoaded: false,
          stepsComplete: true,
          stepsNote: '',
          resultText
        });
      }
    } catch (error) {
      if (!this.unloaded && token === this._runToken) this.setData({ error: error.message || '转换失败，请检查输入' });
    } finally {
      if (!this.unloaded && token === this._runToken) this.setData({ processing: false });
    }
  },

  toggleSteps() {
    if (!this.data.hasResult || this.data.mode !== 'single' || !this._resultInput) return;
    if (this.data.stepsOpen) {
      this.setData({ stepsOpen: false });
      return;
    }
    if (this.data.stepsLoaded) {
      this.setData({ stepsOpen: true });
      return;
    }
    try {
      const result = divisionSteps(this._resultInput.input, this._resultInput.sourceBase, this._resultInput.targetBase, {
        maxSteps: 200,
        maxTextLength: STEP_TEXT_BUDGET
      });
      this.setData({ steps: result.steps, stepsLoaded: true, stepsOpen: true, stepsComplete: result.complete, stepsNote: result.note });
    } catch (error) {
      this.setData({ steps: [], stepsLoaded: true, stepsOpen: true, stepsComplete: false, stepsNote: error.message || '手算步骤生成失败' });
    }
  },

  copyText(value) {
    if (!value) return;
    wx.setClipboardData({
      data: value,
      success: () => wx.showToast({ title: '已复制' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },

  copyTarget() {
    if (this.data.result) this.copyText(this.data.result.value);
  },

  copyCommon(event) {
    const item = this.data.commonResults[Number(event.currentTarget.dataset.index)];
    if (item) this.copyText(item.value);
  },

  copyComplement(event) {
    const field = event.currentTarget.dataset.field;
    if (this.data.complement && this.data.complement[field]) this.copyText(this.data.complement[field]);
  },

  copyBatch() {
    if (this.data.batchResult) this.copyText(this.data.batchResult.text);
  },

  clearAll() {
    if (this.data.processing || this.data.saving) return;
    this.invalidate({ input: '' });
  },

  async saveRecord() {
    if (!this.data.hasResult || !this._resultInput || this.data.saving) return;
    const signature = JSON.stringify(this._resultInput) + this.data.resultText;
    if (signature === this._savedSignature) return wx.showToast({ title: '当前结果已保存', icon: 'none' });
    this.setData({ saving: true });
    try {
      await app.recordOperation({
        ...TOOL,
        modeLabel: this._resultInput.mode === 'batch' ? `批量 ${this.data.batchResult.rows.length} 行` : `${this._resultInput.sourceBase} → ${this._resultInput.targetBase} 进制`,
        detailText: this._resultInput.mode === 'batch' ? `${this.data.batchResult.successCount} 成功 · ${this.data.batchResult.errorCount} 失败` : this.data.statusLabel,
        text: this.data.resultText,
        radixInput: { ...this._resultInput }
      });
      if (this.unloaded) return;
      this._savedSignature = signature;
      this.setData({ saved: true });
      wx.showToast({ title: '已保存到操作记录' });
    } catch (error) {
      if (!this.unloaded) wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      if (!this.unloaded) this.setData({ saving: false });
    }
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: TOOL.page });
  },

  onShareTimeline() {
    return getShareTimeline();
  }
});
