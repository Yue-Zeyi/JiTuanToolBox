const { PRESETS, createPractice, getPracticeState } = require('../../utils/breathing');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
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
    if (this._source) { try { this._source.stop(); } catch (error) {} this._source = null; }
  },
  playCue() {
    try {
      if (!this._audio) this._audio = wx.createWebAudioContext();
      const audio = this._audio;
      if (audio.state === 'suspended') {
        const resume = audio.resume();
        if (resume && resume.catch) resume.catch(() => this.audioUnavailable());
      }
      this.stopSound();
      const sampleRate = audio.sampleRate;
      const buffer = audio.createBuffer(1, Math.floor(sampleRate * 0.16), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.sin(2 * Math.PI * 528 * i / sampleRate) * Math.sin(Math.PI * i / data.length) * 0.12;
      this._source = audio.createBufferSource();
      this._source.buffer = buffer;
      this._source.connect(audio.destination);
      this._source.start();
    } catch (error) { this.audioUnavailable(); }
  },
  audioUnavailable() {
    if (this._unloaded) return;
    this.setData({ sound: false });
    wx.showToast({ title: '当前设备暂不支持提示音', icon: 'none' });
  },
  onHide() { this.pause(); this.stopSound(); },
  onUnload() {
    this._unloaded = true;
    this.clearTimer();
    this.stopSound();
    this.keepScreen(false);
    if (this._audio) { try { const closed = this._audio.close(); if (closed && closed.catch) closed.catch(() => {}); } catch (error) {} }
  },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/breathing/breathing' }); },
  onShareTimeline() { return getShareTimeline(); }
});
