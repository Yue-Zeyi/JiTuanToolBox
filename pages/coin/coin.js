const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const {
  MAX_TOSSES,
  MAX_SESSION_TOSSES,
  prepareCoinSettings,
  tossCoins,
  summarizeSession,
  appendBatch,
  createWechatRandomSource
} = require('../../utils/coin');

const TOOL_PATH = '/pages/coin/coin';
const PAGE_SIZE = 20;

function sideText(side, frontLabel, backLabel) {
  return side === 'front' ? (frontLabel || '正面') : (backLabel || '反面');
}

function presentBatch(batch, sequence) {
  const frontLabel = batch.frontLabel || '';
  const backLabel = batch.backLabel || '';
  return {
    ...batch,
    sequence,
    resultRows: batch.results.map((side, index) => ({ index: index + 1, side, label: sideText(side, frontLabel, backLabel) }))
  };
}

Page({
  data: {
    maxTosses: MAX_TOSSES,
    count: 1,
    frontLabel: '',
    backLabel: '',
    generating: false,
    flipping: false,
    pendingFace: 'front',
    currentBatch: null,
    sessionTotal: 0,
    sessionFront: 0,
    sessionBack: 0,
    sessionFrontRatio: 0,
    sessionBackRatio: 0,
    historyRows: [],
    visibleBatchCount: PAGE_SIZE,
    hasMoreHistory: false,
    expandedBatches: {},
    error: ''
  },

  onLoad() {
    this._batches = [];
    this._animationToken = 0;
    this._animationTimer = null;
    this._secureSource = createWechatRandomSource(wx);
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL_PATH }); },
  onShareTimeline() { return getShareTimeline(); },

  onCountInput(event) {
    if (!this.data.generating && !this.data.flipping) this.setData({ count: event.detail.value, error: '' });
  },
  onFrontLabelInput(event) {
    if (!this.data.generating && !this.data.flipping) this.setData({ frontLabel: event.detail.value, error: '' });
  },
  onBackLabelInput(event) {
    if (!this.data.generating && !this.data.flipping) this.setData({ backLabel: event.detail.value, error: '' });
  },

  async toss() {
    if (this.data.generating || this.data.flipping) return;
    let settings;
    try {
      settings = prepareCoinSettings({ count: this.data.count, frontLabel: this.data.frontLabel, backLabel: this.data.backLabel });
      if (summarizeSession(this._batches).total + settings.count > MAX_SESSION_TOSSES) throw new Error(`当前会话最多保留 ${MAX_SESSION_TOSSES} 次结果，请先清空会话`);
    } catch (error) {
      this.setData({ error: error.message });
      return;
    }
    const token = ++this._animationToken;
    this.setData({ generating: true, error: '' });
    try {
      const result = await tossCoins(settings.count, this._secureSource);
      if (token !== this._animationToken) return;
      const batch = { ...result, frontLabel: settings.frontLabel, backLabel: settings.backLabel };
      this._pendingBatch = batch;
      this.setData({ generating: false, flipping: true, pendingFace: batch.last });
      this._animationTimer = setTimeout(() => this.finishToss(token), 1050);
    } catch (error) {
      if (token === this._animationToken) this.setData({ generating: false, flipping: false, error: '安全随机数获取失败，请更新微信后重试' });
    }
  },

  finishToss(token) {
    if (token !== this._animationToken || !this.data.flipping || !this._pendingBatch) return;
    this._animationTimer = null;
    this._batches = appendBatch(this._batches, this._pendingBatch);
    const currentBatch = presentBatch(this._pendingBatch, this._batches.length);
    this._pendingBatch = null;
    this.setData({ flipping: false, currentBatch });
    this.refreshHistory();
  },

  refreshHistory() {
    const summary = summarizeSession(this._batches);
    const expanded = this.data.expandedBatches;
    const visible = this._batches.slice().reverse().slice(0, this.data.visibleBatchCount).map((batch, index) => {
      const sequence = this._batches.length - index;
      const row = presentBatch(batch, sequence);
      if (!expanded[sequence]) row.resultRows = [];
      return row;
    });
    this.setData({
      sessionTotal: summary.total,
      sessionFront: summary.frontCount,
      sessionBack: summary.backCount,
      sessionFrontRatio: summary.frontRatio,
      sessionBackRatio: summary.backRatio,
      historyRows: visible,
      hasMoreHistory: this._batches.length > visible.length
    });
  },

  toggleBatch(event) {
    const sequence = Number(event.currentTarget.dataset.sequence);
    if (!Number.isInteger(sequence)) return;
    this.setData({ expandedBatches: { ...this.data.expandedBatches, [sequence]: !this.data.expandedBatches[sequence] } });
    this.refreshHistory();
  },

  loadMoreHistory() {
    this.setData({ visibleBatchCount: this.data.visibleBatchCount + PAGE_SIZE });
    this.refreshHistory();
  },

  copyCurrent() {
    const batch = this.data.currentBatch;
    if (!batch || this.data.flipping) return;
    const detail = batch.resultRows.map(row => `${row.index}. ${row.label}`).join('\n');
    const text = `本批共 ${batch.results.length} 次\n正面 ${batch.frontCount} 次（${batch.frontRatio}%）\n反面 ${batch.backCount} 次（${batch.backRatio}%）\n${detail}`;
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '已复制' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) });
  },

  clearSession() {
    if (this.data.generating || this.data.flipping) return;
    this._batches = [];
    this.setData({ currentBatch: null, visibleBatchCount: PAGE_SIZE, expandedBatches: {}, historyRows: [], sessionTotal: 0, sessionFront: 0, sessionBack: 0, sessionFrontRatio: 0, sessionBackRatio: 0, hasMoreHistory: false });
  },

  cancelToss() {
    this._animationToken++;
    if (this._animationTimer !== null) clearTimeout(this._animationTimer);
    this._animationTimer = null;
    this._pendingBatch = null;
    if (this.data.generating || this.data.flipping) this.setData({ generating: false, flipping: false });
  },

  onHide() { this.cancelToss(); },
  onUnload() { this.cancelToss(); }
});
