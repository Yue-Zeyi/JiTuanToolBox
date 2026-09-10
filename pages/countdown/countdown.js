const { PRESETS, durationMs, formatRemaining, Countdown } = require('../../utils/countdown');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { createLocalAudioPlayer } = require('../../utils/local-audio');
Page({
  data: {
    hours: '0', minutes: '5', seconds: '0', presets: PRESETS, selected: 300,
    status: 'idle', display: '00:05:00', progress: 0, ring: '', endText: '', totalText: '00:05:00',
    sound: true, vibration: true, screenOn: true, alerting: false, error: '', audioNote: '', vibrationNote: ''
  },
  onLoad() {
    this.clock = new Countdown(); this.unloaded = false;
    this.alarmAudio = createLocalAudioPlayer({
      src: '/assets/audio/countdown-alarm.mp3',
      volume: 0.95,
      onError: () => this.audioFailure()
    });
    this.update();
  },
  onShow() {
    this.visible = true;
    const bar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (bar) bar.setData({ visible: false });
    this.update(); this.startRender(); this.keepScreen();
  },
  onHide() { this.visible = false; this.clearRender(); this.stopAlarm(); this.keepScreen(); },
  onUnload() {
    this.unloaded = true; this.visible = false; this.clearRender(); this.clearTestSound(); this.stopAlarm(); this.keepScreen();
    if (this.alarmAudio) this.alarmAudio.destroy();
    this.alarmAudio = null;
  },
  isActive() { return this.clock && ['running', 'paused'].includes(this.clock.status); },
  onInput(event) {
    if (this.isActive()) return;
    const key = event.currentTarget.dataset.key;
    if (!['hours', 'minutes', 'seconds'].includes(key)) return;
    this.setData({ [key]: event.detail.value, selected: 0 }); this.preview();
  },
  preset(event) {
    if (this.isActive()) return wx.showToast({ title: '请先重置，再修改时长', icon: 'none' });
    const seconds = Number(event.currentTarget.dataset.seconds);
    if (!PRESETS.some(item => item.seconds === seconds)) return;
    this.setData({ hours: String(Math.floor(seconds / 3600)), minutes: String(Math.floor(seconds / 60) % 60), seconds: String(seconds % 60), selected: seconds }); this.preview();
  },
  preview() {
    this.stopAlarm(); this.notified = false;
    let ms = 0;
    try { ms = durationMs(this.data.hours, this.data.minutes, this.data.seconds); } catch (error) {}
    this.clock.reset(ms); this.setData({ error: '', totalText: formatRemaining(ms) }); this.update();
  },
  toggleRunning() {
    this.clearTestSound();
    if (this.clock.status === 'running') {
      this.clock.pause(); this.clearRender(); this.update(); this.keepScreen(); return;
    }
    if (this.clock.status !== 'paused') {
      let ms;
      try { ms = durationMs(this.data.hours, this.data.minutes, this.data.seconds); }
      catch (error) { this.setData({ error: error.message }); return wx.showToast({ title: error.message, icon: 'none' }); }
      this.clock.reset(ms); this.notified = false; this.setData({ totalText: formatRemaining(ms) });
    }
    this.stopAlarm(); this.setData({ error: '' });
    if (this.data.sound && this.alarmAudio) this.alarmAudio.prime();
    this.clock.start(); this.update(); this.startRender(); this.keepScreen();
  },
  reset() {
    const apply = () => { if (this.unloaded) return; this.clearRender(); this.preview(); this.keepScreen(); };
    if (this.isActive()) wx.showModal({ title: '重置倒计时', content: '将停止本次计时，恢复设置的完整时长。', success: result => { if (result.confirm) apply(); } });
    else apply();
  },
  update() {
    if (!this.clock || this.unloaded) return;
    const state = this.clock.sample();
    const date = new Date(state.endAt);
    const pad = n => String(n).padStart(2, '0');
    const endText = state.status === 'running' ? `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : '';
    const patch = { status: state.status, display: formatRemaining(state.remainingMs), progress: state.progress, endText };
    const ringKey = state.status + ':' + state.progress;
    if (this.ringKey !== ringKey) {
      this.ringKey = ringKey;
      const color = state.status === 'done' ? '#25A76B' : state.status === 'paused' ? '#91A4BC' : '#2F80ED';
      const circumference = 578.053;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="#E8EEF7" stroke-width="8"/><circle cx="100" cy="100" r="92" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - state.progress / 100)}" transform="rotate(-90 100 100)"/></svg>`;
      const bytes = new Uint8Array(svg.length); for (let i = 0; i < svg.length; i++) bytes[i] = svg.charCodeAt(i);
      patch.ring = 'data:image/svg+xml;base64,' + wx.arrayBufferToBase64(bytes.buffer);
    }
    this.setData(patch);
    if (state.status === 'done') {
      this.clearRender(); this.keepScreen();
      if (this.visible && !this.notified) { this.notified = true; this.notifyEnd(); }
    }
  },
  startRender() { if (!this.renderTimer && this.visible && this.clock.status === 'running') this.renderTimer = setInterval(() => this.update(), 200); },
  clearRender() { if (this.renderTimer) clearInterval(this.renderTimer); this.renderTimer = null; },
  toggleOption(event) {
    const key = event.currentTarget.dataset.key;
    if (!['sound', 'vibration', 'screenOn'].includes(key)) return;
    this.setData({ [key]: Boolean(event.detail.value) });
    if (key === 'sound' && !this.data.sound) this.stopSound();
    if (key === 'screenOn') this.keepScreen();
  },
  keepScreen() { if (typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn: Boolean(this.visible && this.data.screenOn && this.clock && this.clock.status === 'running'), fail: () => {} }); },
  playSound() {
    if (this.unloaded || !this.visible || !this.alarmAudio || !this.alarmAudio.play()) return this.audioFailure();
    this.setData({ audioNote: '' });
  },
  audioFailure() { if (!this.unloaded) this.setData({ audioNote: '当前设备无法播放提醒音，请留意屏幕提示和振动。' }); },
  stopSound() { if (this.alarmAudio) this.alarmAudio.stop(); },
  clearTestSound() { if (this.testSoundTimer) clearTimeout(this.testSoundTimer); this.testSoundTimer = null; },
  testSound() {
    if (this.data.alerting) return;
    this.clearTestSound();
    this.playSound();
    this.testSoundTimer = setTimeout(() => { this.testSoundTimer = null; if (!this.data.alerting) this.stopSound(); }, 1600);
  },
  notifyEnd() {
    this.clearTestSound();
    this.setData({ alerting: true });
    if (this.data.sound) this.playSound();
    if (this.data.vibration && typeof wx.vibrateLong === 'function') wx.vibrateLong({ fail: () => { if (!this.unloaded) this.setData({ vibrationNote: '当前设备未能振动，请留意屏幕提示。' }); } });
    this.alarmTimer = setTimeout(() => this.stopAlarm(), 8000);
  },
  stopAlarm() { this.stopSound(); if (this.alarmTimer) clearTimeout(this.alarmTimer); this.alarmTimer = null; if (!this.unloaded) this.setData({ alerting: false }); },
  onShareAppMessage() { return getShareAppMessage({ path: '/pages/countdown/countdown' }); },
  onShareTimeline() { return getShareTimeline(); }
});
