const PRESETS = [
  { seconds: 180, title: '泡面 3 分钟' }, { seconds: 300, title: '5 分钟' },
  { seconds: 480, title: '煮蛋 8 分钟' }, { seconds: 1800, title: '会议 30 分钟' },
  { seconds: 3600, title: '考试 60 分钟' }, { seconds: 30, title: '间歇 30 秒' }
];
function durationMs(hours, minutes, seconds) {
  const values = [hours, minutes, seconds].map((value, index) => {
    const text = String(value).trim();
    if (!/^\d*$/.test(text)) throw new Error('时、分、秒请填写非负整数');
    const n = Number(text), max = index === 0 ? 99 : 59;
    if (n > max) throw new Error(index === 0 ? '小时范围为 0—99' : '分钟和秒钟范围为 0—59');
    return n;
  });
  const ms = (values[0] * 3600 + values[1] * 60 + values[2]) * 1000;
  if (!ms) throw new Error('请先设置大于 0 秒的时长');
  return ms;
}
function formatRemaining(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  const pad = value => String(value).padStart(2, '0');
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(pad).join(':');
}
class Countdown {
  constructor(now = () => Date.now()) { this.now = now; this.reset(300000); }
  reset(totalMs) { this.totalMs = totalMs; this.remainingMs = totalMs; this.endAt = 0; this.status = 'idle'; }
  start() {
    if (this.status === 'running') return;
    if (this.status !== 'paused') this.remainingMs = this.totalMs;
    this.endAt = this.now() + this.remainingMs;
    this.status = 'running';
  }
  pause() { this.sample(); if (this.status === 'running') { this.status = 'paused'; this.endAt = 0; } }
  sample() {
    if (this.status === 'running') {
      this.remainingMs = Math.min(this.totalMs, Math.max(0, this.endAt - this.now()));
      if (this.remainingMs === 0) this.status = 'done';
    }
    return { status: this.status, remainingMs: this.remainingMs, endAt: this.endAt, progress: this.totalMs ? Math.floor((1 - this.remainingMs / this.totalMs) * 100) : 0 };
  }
}
module.exports = { PRESETS, durationMs, formatRemaining, Countdown };
