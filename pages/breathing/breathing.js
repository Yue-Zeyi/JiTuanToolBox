const { PRESETS, createPractice, getPracticeState } = require('../../utils/breathing');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { createLocalAudioPlayer } = require('../../utils/local-audio');
const timeText = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

Page({
  data: {
    presets: [...PRESETS, { key: 'custom', title: '自定义节奏', detail: '按舒适程度设置各阶段秒数' }], presetIndex: 2,
    inhale: 4, holdIn: 0, exhale: 6, holdOut: 0, targetMode: 'duration', minutes: 3, rounds: 10,
    sound: false, vibration: false, fullScreen: false, status: 'idle', phase: 'inhale', label: '准备',
    countdown: 4, scale: 0.58, progress: 0, round: 1, elapsedMs: 0, elapsedText: '0:00', remainingText: '', error: ''
  },
  onLoad() {
    const performance = typeof wx.getPerformance === 'function' ? wx.getPerformance() : null;
    this._now = performance && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
    this._elapsed = 0;
    this._unloaded = false;
    this._cueAudio = createLocalAudioPlayer({
      src: '/assets/audio/breathing-cue.mp3',
      volume: 0.9,
      onError: () => this.audioUnavailable()
    });
  },
  onPresetChange(event) {
    if (this.isActive()) return;
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || !this.data.presets[index]) return;
    const preset = this.data.presets[index];
    const patch = { presetIndex: index };
    if (preset.key !== 'custom') ['inhale', 'holdIn', 'exhale', 'holdOut'].forEach(key => { patch[key] = preset[key]; });
    this.resetPreview(patch);
  },
  onStageInput(event) {
    const key = event.currentTarget.dataset.key;
    if (!this.isActive() && ['inhale', 'holdIn', 'exhale', 'holdOut'].includes(key)) this.resetPreview({ [key]: event.detail.value, presetIndex: 4 });
  },
  onTargetMode(event) {
    const targetMode = event.currentTarget.dataset.mode;
    if (!this.isActive() && ['duration', 'rounds'].includes(targetMode)) this.resetPreview({ targetMode });
  },
  onTargetInput(event) {
    const key = event.currentTarget.dataset.key;
    if (!this.isActive() && ['minutes', 'rounds'].includes(key)) this.resetPreview({ [key]: event.detail.value });
  },
  onFeedbackToggle(event) {
    const key = event.currentTarget.dataset.key;
    if (!['sound', 'vibration'].includes(key)) return;
    this.setData({ [key]: Boolean(event.detail.value) });
    if (key === 'sound' && !event.detail.value) this.stopSound();
    if (key === 'sound' && event.detail.value) this.playCue();
  },
  toggleFullScreen() { this.setData({ fullScreen: !this.data.fullScreen }); },
  isActive() { return this.data.status === 'running' || this.data.status === 'paused'; },
  resetPreview(patch) {
    this.setData({ ...patch, status: 'idle', label: '准备', countdown: patch.inhale || this.data.inhale, scale: 0.58, progress: 0, round: 1, elapsedMs: 0, elapsedText: '0:00', remainingText: '', error: '' });
  },
  start() {
    if (this.data.status === 'running') return;
    if (this.data.status !== 'paused') {
      try { this._plan = createPractice(this.data); }
      catch (error) { this.setData({ error: error.message }); return; }
      this._elapsed = 0;
      this._phase = '';
    }
    this._startedAt = this._now();
    this.setData({ status: 'running', error: '' });
    this.keepScreen(true);
    this.tick();
    this._timer = setInterval(() => this.tick(), 100);
  },
  tick() {
    if (this._unloaded || this.data.status !== 'running') return;
    const state = getPracticeState(this._plan, this._elapsed + this._now() - this._startedAt);
    const phaseKey = `${state.round}:${state.phase}`;
    if (phaseKey !== this._phase && !state.finished) {
      this._phase = phaseKey;
      if (this.data.sound) this.playCue();
      if (this.data.vibration && typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light', fail: () => {} });
    }
    this.setData({ ...state, elapsedText: timeText(Math.floor(state.elapsedMs / 1000)), remainingText: timeText(state.remainingSeconds), status: state.finished ? 'done' : 'running' });
    if (state.finished) {
      this._elapsed = state.elapsedMs;
      this.clearTimer();
      this.stopSound();
      this.keepScreen(false);
    }
  },
  pause() {
    if (this.data.status !== 'running') return;
    this.tick();
    this._elapsed = this.data.elapsedMs;
    this.clearTimer();
    this.stopSound();
    this.keepScreen(false);
    if (this.data.status === 'running') this.setData({ status: 'paused' });
  },
  stop() {
    if (this.data.status === 'running') this.tick();
    this.clearTimer();
    this.stopSound();
    this.keepScreen(false);
    this._elapsed = this.data.elapsedMs;
    this.setData({ status: 'stopped', label: '练习结束', scale: 0.58, countdown: 0 });
  },
  clearTimer() {
    if (this._timer !== undefined) clearInterval(this._timer);
    this._timer = undefined;
  },
  keepScreen(keepScreenOn) {
    if (typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn, fail: () => {} });
  },
  stopSound() {
    if (this._cueAudio) this._cueAudio.stop();
  },
  playCue() {
    if (!this._cueAudio || !this._cueAudio.play()) this.audioUnavailable();
  },
  audioUnavailable() {
    if (this._unloaded) return;
    const shouldNotify = this.data.sound;
    this.setData({ sound: false });
    if (shouldNotify) wx.showToast({ title: '当前设备暂不支持提示音', icon: 'none' });
  },
  onHide() { this.pause(); this.stopSound(); },
  onUnload() {
    this._unloaded = true;
    this.clearTimer();
    this.stopSound();
    this.keepScreen(false);
    if (this._cueAudio) this._cueAudio.destroy();
    this._cueAudio = null;
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/breathing/breathing' }); },
  onShareTimeline() { return getShareTimeline(); }
});
