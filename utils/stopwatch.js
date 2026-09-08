function formatDuration(milliseconds) {
  const value = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(value / 3600000);
  const minutes = Math.floor(value / 60000) % 60;
  const seconds = Math.floor(value / 1000) % 60;
  const pad = number => String(number).padStart(2, '0');
  return `${hours ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(seconds)}.${String(value % 1000).padStart(3, '0')}`;
}

class Stopwatch {
  constructor({ now, wallNow }) {
    this.now = now;
    this.wallNow = wallNow;
    this.reset();
  }

  reset() {
    this.running = false;
    this.accumulated = 0;
    this.lastElapsed = 0;
    this.startedAt = 0;
    this.hidden = null;
    this.laps = [];
  }

  elapsed() {
    const value = this.accumulated + (this.running ? Math.max(0, this.now() - this.startedAt) : 0);
    this.lastElapsed = Math.max(this.lastElapsed, value);
    return this.lastElapsed;
  }

  time() {
    const elapsedMs = Math.floor(this.elapsed());
    const lastLap = this.laps[this.laps.length - 1];
    return { running: this.running, elapsedMs, splitMs: elapsedMs - (lastLap ? lastLap.totalMs : 0) };
  }

  start() {
    if (this.running) return;
    this.startedAt = this.now();
    this.running = true;
  }

  pause() {
    if (!this.running) return;
    this.show();
    this.accumulated = this.elapsed();
    this.running = false;
  }

  lap() {
    if (!this.running) return false;
    const { elapsedMs, splitMs } = this.time();
    this.laps.push({ number: this.laps.length + 1, totalMs: elapsedMs, splitMs });
    return true;
  }

  lapResults() {
    let fastest = Infinity;
    let slowest = -Infinity;
    this.laps.forEach(lap => { fastest = Math.min(fastest, lap.splitMs); slowest = Math.max(slowest, lap.splitMs); });
    return this.laps.map(lap => ({
      ...lap,
      fastest: this.laps.length > 1 && lap.splitMs === fastest,
      slowest: this.laps.length > 1 && lap.splitMs === slowest
    }));
  }

  hide() {
    if (!this.running || this.hidden) return;
    this.hidden = { elapsed: this.elapsed(), mono: this.now(), wall: this.wallNow() };
  }

  show() {
    if (!this.hidden) return;
    const mono = this.now();
    // Some devices suspend the monotonic clock during lock. Wall time fills that gap,
    // but a device-clock adjustment while hidden cannot be distinguished from sleep.
    const passage = Math.max(0, mono - this.hidden.mono, this.wallNow() - this.hidden.wall);
    this.accumulated = this.hidden.elapsed + passage;
    this.startedAt = mono;
    this.hidden = null;
  }
}

module.exports = { Stopwatch, formatDuration };
