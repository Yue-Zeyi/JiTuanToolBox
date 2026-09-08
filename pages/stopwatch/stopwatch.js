const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { createMonotonicClock } = require('../../utils/reaction');
const { Stopwatch, formatDuration } = require('../../utils/stopwatch');

Page({
  data: {
    running: false,
    elapsedMs: 0,
    display: '00:00.000',
    splitDisplay: '00:00.000',
    displaySize: 72,
    laps: [],
    clockDegraded: false
  },

  onLoad() {
    this.unloaded = false;
    this.visible = false;
    const clock = createMonotonicClock(wx);
    this.watch = new Stopwatch({ now: clock.now, wallNow: () => Date.now() });
    this.setData({ clockDegraded: clock.degraded });
  },

  onShow() {
    if (!this.watch || this.unloaded) return;
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
    this.visible = true;
    this.watch.show();
    this.updateDisplay();
    this.startRenderTimer();
  },

  onHide() {
    this.visible = false;
    if (this.watch) this.watch.hide();
    this.stopRenderTimer();
  },

  onUnload() {
    this.unloaded = true;
    this.visible = false;
    this.stopRenderTimer();
  },

  updateDisplay() {
    if (this.unloaded || !this.visible) return;
    const { running, elapsedMs, splitMs } = this.watch.time();
    const display = formatDuration(elapsedMs);
    this.setData({
      running, elapsedMs, display,
      splitDisplay: formatDuration(splitMs),
      displaySize: Math.min(72, Math.floor(560 / (display.length * 0.61)))
    });
  },

  startRenderTimer() {
    if (this.renderTimer || !this.visible || !this.watch.running) return;
    this.renderTimer = setInterval(() => this.updateDisplay(), 33);
  },

  stopRenderTimer() {
    if (!this.renderTimer) return;
    clearInterval(this.renderTimer);
    this.renderTimer = null;
  },

  toggleRunning() {
    if (!this.watch || this.unloaded) return;
    if (this.watch.running) {
      this.watch.pause();
      this.stopRenderTimer();
    } else {
      this.watch.start();
      this.startRenderTimer();
    }
    this.updateDisplay();
  },

  recordLap() {
    if (!this.watch || this.unloaded || !this.watch.lap()) return;
    const laps = this.watch.lapResults();
    const fastestCount = laps.filter(lap => lap.fastest).length;
    const slowestCount = laps.filter(lap => lap.slowest).length;
    this.setData({ laps: laps.map(lap => ({
      ...lap,
      splitDisplay: formatDuration(lap.splitMs),
      totalDisplay: formatDuration(lap.totalMs),
      fastestLabel: lap.fastest ? `${fastestCount > 1 ? '并列' : ''}最快` : '',
      slowestLabel: lap.slowest ? `${slowestCount > 1 ? '并列' : ''}最慢` : ''
    })).reverse() });
    this.updateDisplay();
  },

  reset() {
    if (!this.watch || this.unloaded) return;
    this.stopRenderTimer();
    this.watch.reset();
    this.setData({ laps: [] });
    this.updateDisplay();
  },

  copyAll() {
    if (!this.watch || this.unloaded) return;
    const time = this.watch.time();
    if (!time.elapsedMs && !this.data.laps.length) return;
    const rows = this.watch.lapResults().map(lap => `${lap.number}\t${formatDuration(lap.splitMs)}\t${formatDuration(lap.totalMs)}`);
    wx.setClipboardData({
      data: [`总用时\t${formatDuration(time.elapsedMs)}`, '计次\t本次用时\t累计用时', ...rows].join('\n'),
      success: () => wx.showToast({ title: '计时记录已复制' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },

  onShareAppMessage() { return getShareAppMessage({ path: '/pages/stopwatch/stopwatch' }); },
  onShareTimeline() { return getShareTimeline(); }
});
