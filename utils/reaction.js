const { createWechatRandomSource } = require('./password');

const ROUND_TARGETS = [3, 5, 10];
const MIN_WAIT = 1500;
const MAX_WAIT = 5000;
const MIN_VALID_REACTION = 100;
const ROUND_TIMEOUT = 10000;
const STORAGE_KEY = 'jituan_reaction_best_v1';

async function secureInt(maxExclusive, readBytes) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 65536 || typeof readBytes !== 'function') throw new Error('安全随机参数无效');
  const limit = 65536 - (65536 % maxExclusive);
  while (true) {
    const bytes = await readBytes(2);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 2) throw new Error('安全随机数获取失败，请更新微信后重试');
    const value = bytes[0] * 256 + bytes[1];
    if (value < limit) return value % maxExclusive;
  }
}

async function getRandomWait(readBytes) {
  return MIN_WAIT + await secureInt(MAX_WAIT - MIN_WAIT + 1, readBytes);
}

function createMonotonicClock(api) {
  try {
    const performance = api && typeof api.getPerformance === 'function' ? api.getPerformance() : null;
    if (performance && typeof performance.now === 'function') return { now: () => performance.now(), degraded: false };
  } catch (error) {}
  return { now: () => Date.now(), degraded: true };
}

class ReactionMachine {
  constructor(options = {}) {
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.schedule = typeof options.schedule === 'function' ? options.schedule : (callback, delay) => setTimeout(callback, delay);
    this.clearScheduled = typeof options.clearScheduled === 'function' ? options.clearScheduled : id => clearTimeout(id);
    this.onState = typeof options.onState === 'function' ? options.onState : () => {};
    this.target = 5;
    this.scores = [];
    this.status = 'idle';
    this.token = 0;
    this.timerId = null;
    this.greenAt = null;
  }

  snapshot() {
    const validCount = this.scores.length;
    const total = this.scores.reduce((sum, value) => sum + value, 0);
    return {
      status: this.status,
      target: this.target,
      token: this.token,
      scores: this.scores.slice(),
      validCount,
      average: validCount ? Math.round(total / validCount) : null,
      best: validCount ? Math.min(...this.scores) : null,
      greenAt: this.greenAt
    };
  }

  publish() {
    const value = this.snapshot();
    this.onState(value);
    return value;
  }

  clearTimer() {
    if (this.timerId !== null) this.clearScheduled(this.timerId);
    this.timerId = null;
  }

  start(target = 5) {
    if (!ROUND_TARGETS.includes(Number(target))) throw new Error('测试轮数仅支持 3、5 或 10 轮');
    this.clearTimer();
    this.token++;
    this.target = Number(target);
    this.scores = [];
    this.greenAt = null;
    this.status = 'idle';
    return this.publish();
  }

  beginRound(delay) {
    if (!Number.isInteger(delay) || delay < MIN_WAIT || delay > MAX_WAIT) throw new Error('等待时间无效');
    if (this.status === 'waiting' || this.status === 'greenPending' || this.status === 'green' || this.status === 'complete') throw new Error('当前不能开始新一轮');
    this.clearTimer();
    const token = ++this.token;
    this.greenAt = null;
    this.status = 'waiting';
    this.timerId = this.schedule(() => {
      if (token !== this.token || this.status !== 'waiting') return;
      this.timerId = null;
      this.status = 'greenPending';
      this.publish();
    }, delay);
    this.publish();
    return token;
  }

  markGreenRendered(token) {
    if (token !== this.token || this.status !== 'greenPending') return false;
    this.greenAt = this.now();
    this.status = 'green';
    this.timerId = this.schedule(() => {
      if (token !== this.token || this.status !== 'green') return;
      this.timerId = null;
      this.greenAt = null;
      this.status = 'invalid';
      this.publish();
    }, ROUND_TIMEOUT);
    this.publish();
    return true;
  }

  press() {
    if (this.status === 'waiting' || this.status === 'greenPending') {
      this.clearTimer();
      this.token++;
      this.greenAt = null;
      this.status = 'early';
      return this.publish();
    }
    if (this.status !== 'green') return this.snapshot();
    const rawElapsed = this.now() - this.greenAt;
    this.clearTimer();
    this.greenAt = null;
    this.token++;
    if (!Number.isFinite(rawElapsed) || rawElapsed < MIN_VALID_REACTION) {
      this.status = 'early';
      return this.publish();
    }
    if (rawElapsed > ROUND_TIMEOUT) {
      this.status = 'invalid';
      return this.publish();
    }
    const elapsed = Math.round(rawElapsed);
    this.scores.push(elapsed);
    this.status = this.scores.length >= this.target ? 'complete' : 'result';
    return this.publish();
  }

  cancelActive() {
    this.clearTimer();
    this.token++;
    this.greenAt = null;
    if (['waiting', 'greenPending', 'green'].includes(this.status)) this.status = 'idle';
    return this.publish();
  }
}

function mergePersonalBest(current, summary) {
  if (!summary || !ROUND_TARGETS.includes(Number(summary.target)) || !Number.isFinite(summary.average) || !Number.isFinite(summary.best)) throw new Error('成绩无效');
  const source = current && typeof current === 'object' ? current : {};
  const averages = {};
  ROUND_TARGETS.forEach(target => {
    const value = source.averages && Number(source.averages[target]);
    if (Number.isFinite(value) && value >= MIN_VALID_REACTION) averages[target] = value;
  });
  const target = Number(summary.target);
  averages[target] = averages[target] === undefined ? summary.average : Math.min(averages[target], summary.average);
  const oldSingle = Number(source.single);
  const single = Number.isFinite(oldSingle) && oldSingle >= MIN_VALID_REACTION ? Math.min(oldSingle, summary.best) : summary.best;
  return { averages, single };
}

module.exports = {
  ROUND_TARGETS,
  MIN_WAIT,
  MAX_WAIT,
  MIN_VALID_REACTION,
  ROUND_TIMEOUT,
  STORAGE_KEY,
  secureInt,
  getRandomWait,
  createMonotonicClock,
  ReactionMachine,
  mergePersonalBest,
  createWechatRandomSource
};
