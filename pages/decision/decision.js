const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const {
  MAX_INPUT_LENGTH,
  MODES,
  prepareOptions,
  chooseDecision,
  getVisualTarget,
  createWechatRandomSource
} = require('../../utils/decision');

const TOOL_PATH = '/pages/decision/decision';
const DEFAULT_OPTIONS = '吃火锅\n吃烤肉\n吃日料\n吃轻食';
const COLORS = ['#7667D8', '#9B8DE5', '#6455C7', '#B1A4EA', '#5748B5', '#8A7BDD'];

function createWheel(options) {
  const step = 360 / options.length;
  const numbered = options.length > 8;
  const slices = options.map((value, index) => `${COLORS[index % COLORS.length]} ${index * step}deg ${(index + 1) * step}deg`);
  return {
    numbered,
    background: `conic-gradient(from ${-step / 2}deg, ${slices.join(',')})`,
    labels: options.map((value, index) => ({
      value: numbered ? String(index + 1) : value,
      style: `transform:rotate(${index * step}deg) translateY(-132rpx) rotate(${-index * step}deg);`
    }))
  };
}

Page({
  data: {
    maxInputLength: MAX_INPUT_LENGTH,
    optionsText: DEFAULT_OPTIONS,
    modes: [
      { key: 'wheel', title: '转盘' },
      { key: 'grid', title: '宫格' },
      { key: 'draw', title: '抽签' },
      { key: 'roll', title: '滚动' },
      { key: 'flip', title: '翻牌' }
    ],
    mode: 'wheel',
    options: [],
    duplicateCount: 0,
    wheelBackground: '',
    wheelLabels: [],
    wheelNumbered: false,
    wheelRotation: 0,
    targetIndex: -1,
    highlightIndex: -1,
    rollingText: '',
    pendingResult: '',
    result: '',
    history: [],
    choosing: false,
    animating: false,
    error: ''
  },

  onLoad() {
    this._animationToken = 0;
    this._animationTimer = null;
    this._secureSource = createWechatRandomSource(wx);
    this.previewOptions(DEFAULT_OPTIONS);
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: TOOL_PATH });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  previewOptions(value) {
    try {
      const parsed = prepareOptions(value);
      const wheel = createWheel(parsed.options);
      this.setData({ options: parsed.options, duplicateCount: parsed.duplicateCount, wheelBackground: wheel.background, wheelLabels: wheel.labels, wheelNumbered: wheel.numbered, error: '' });
    } catch (error) {
      this.setData({ options: [], duplicateCount: 0, wheelLabels: [], wheelNumbered: false, error: '' });
    }
  },

  onOptionsInput(event) {
    if (this.data.choosing || this.data.animating) return;
    const optionsText = event.detail.value;
    this.setData({ optionsText, result: '', pendingResult: '', targetIndex: -1, highlightIndex: -1, rollingText: '', error: '' });
    this.previewOptions(optionsText);
  },

  selectMode(event) {
    if (this.data.choosing || this.data.animating) return;
    const mode = event.currentTarget.dataset.mode;
    if (MODES.includes(mode)) this.setData({ mode, result: '', pendingResult: '', targetIndex: -1, highlightIndex: -1, rollingText: '', error: '' });
  },

  async decide() {
    if (this.data.choosing || this.data.animating) return;
    let parsed;
    try {
      parsed = prepareOptions(this.data.optionsText);
    } catch (error) {
      this.setData({ error: error.message });
      return;
    }
    const token = ++this._animationToken;
    this.setData({ choosing: true, error: '', result: '', pendingResult: '', targetIndex: -1, highlightIndex: -1, rollingText: '' });
    try {
      const selected = await chooseDecision(parsed.options, this._secureSource);
      if (token !== this._animationToken) return;
      const visual = getVisualTarget(this.data.mode, selected.index, parsed.options.length);
      this._selectedIndex = visual.index;
      const wheel = createWheel(parsed.options);
      const patch = {
        choosing: false,
        animating: true,
        options: parsed.options,
        duplicateCount: parsed.duplicateCount,
        wheelBackground: wheel.background,
        wheelLabels: wheel.labels,
        wheelNumbered: wheel.numbered,
        targetIndex: -1,
        pendingResult: selected.value
      };
      if (this.data.mode === 'wheel') {
        const step = 360 / parsed.options.length;
        const desired = ((-selected.index * step % 360) + 360) % 360;
        const current = ((this.data.wheelRotation % 360) + 360) % 360;
        patch.wheelRotation = this.data.wheelRotation + 5 * 360 + ((desired - current + 360) % 360);
      }
      this.setData(patch);
      if (['grid', 'roll'].includes(this.data.mode)) {
        this.setData({ highlightIndex: 0, rollingText: parsed.options[0] });
        const steps = parsed.options.length * 2 + selected.index;
        this.advanceHighlight(token, 0, steps);
      } else {
        this._animationTimer = setTimeout(() => this.finishAnimation(token), this.data.mode === 'draw' ? 1100 : 1800);
      }
    } catch (error) {
      if (token === this._animationToken) this.setData({ choosing: false, animating: false, error: '安全随机数获取失败，请更新微信后重试' });
    }
  },

  advanceHighlight(token, step, total) {
    if (token !== this._animationToken || !this.data.animating) return;
    if (step >= total) return this.finishAnimation(token);
    // Slow the last few steps without exposing the final selection to the view.
    const delay = step < total - 5 ? 55 : 100 + (step - total + 5) * 35;
    this._animationTimer = setTimeout(() => {
      if (token !== this._animationToken || !this.data.animating) return;
      const next = step + 1;
      if (next >= total) return this.finishAnimation(token);
      const highlightIndex = next % this.data.options.length;
      this.setData({ highlightIndex, rollingText: this.data.options[highlightIndex] });
      this.advanceHighlight(token, next, total);
    }, delay);
  },

  finishAnimation(token) {
    if (token !== this._animationToken || !this.data.animating || !this.data.pendingResult) return;
    this._animationTimer = null;
    const result = this.data.pendingResult;
    this.setData({ animating: false, result, targetIndex: this._selectedIndex, highlightIndex: this._selectedIndex, rollingText: result, history: [result].concat(this.data.history) });
  },

  cancelAnimation() {
    this._animationToken++;
    if (this._animationTimer !== null) clearTimeout(this._animationTimer);
    this._animationTimer = null;
    if (this.data.choosing || this.data.animating) this.setData({ choosing: false, animating: false, pendingResult: '', targetIndex: -1, highlightIndex: -1, rollingText: '' });
  },

  copyResult() {
    if (!this.data.result || this.data.choosing || this.data.animating) return;
    wx.setClipboardData({ data: this.data.result, success: () => wx.showToast({ title: '已复制' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) });
  },

  clearHistory() {
    if (this.data.choosing || this.data.animating) return;
    this.setData({ history: [], result: '', pendingResult: '', targetIndex: -1, highlightIndex: -1, rollingText: '' });
  },

  onHide() { this.cancelAnimation(); },
  onUnload() { this.cancelAnimation(); }
});
