const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const {
  ROUND_TARGETS,
  STORAGE_KEY,
  getRandomWait,
  createMonotonicClock,
  ReactionMachine,
  mergePersonalBest,
  createWechatRandomSource
} = require('../../utils/reaction');

const TOOL_PATH = '/pages/reaction/reaction';

function tierFor(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 200) return '快';
  if (value < 300) return '常见区间';
  return '仍可练习';
}

function safeBest(value) {
  if (!value || typeof value !== 'object') return { averages: {}, single: null };
  const averages = {};
  ROUND_TARGETS.forEach(target => {
    const average = Number(value.averages && value.averages[target]);
    if (Number.isFinite(average) && average >= 100) averages[target] = average;
  });
  const single = Number(value.single);
  return { averages, single: Number.isFinite(single) && single >= 100 ? single : null };
}

function bestDisplay(personalBest) {
  return {
    best3: personalBest.averages[3] || null,
    best5: personalBest.averages[5] || null,
    best10: personalBest.averages[10] || null,
    bestSingle: personalBest.single || null
  };
}

Page({
  data: {
    roundOptions: ROUND_TARGETS,
    target: 5,
    status: 'idle',
    statusTitle: '点击开始',
    statusHint: '点击此区域开始，等画面变绿后立即点击',
    preparing: false,
    scores: [],
    validCount: 0,
    average: null,
    best: null,
    tier: '',
    personalBest: { averages: {}, single: null },
    best3: null,
    best5: null,
    best10: null,
    bestSingle: null,
    clockDegraded: false,
    error: ''
  },

  onLoad() {
    this._roundRequest = 0;
    this._secureSource = createWechatRandomSource(wx);
    const clock = createMonotonicClock(wx);
    this._clock = clock;
    let personalBest;
    try { personalBest = safeBest(wx.getStorageSync(STORAGE_KEY)); } catch (error) { personalBest = safeBest(null); }
    this.setData({ personalBest, ...bestDisplay(personalBest), clockDegraded: clock.degraded });
    this.machine = new ReactionMachine({
      now: clock.now,
      schedule: (callback, delay) => setTimeout(callback, delay),
      clearScheduled: timer => clearTimeout(timer),
      onState: snapshot => this.onMachineState(snapshot)
    });
    this.machine.start(this.data.target);
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onShareAppMessage() { return getShareAppMessage({ path: TOOL_PATH }); },
  onShareTimeline() { return getShareTimeline(); },

  selectRounds(event) {
    if (this.data.preparing || ['waiting', 'greenPending', 'green'].includes(this.data.status)) return;
    const target = Number(event.currentTarget.dataset.target);
    if (!ROUND_TARGETS.includes(target)) return;
    this.machine.start(target);
    this.setData({ target, error: '' });
  },

  startTest() {
    if (this.data.preparing || ['waiting', 'greenPending', 'green'].includes(this.data.status)) return;
    this.machine.start(Number(this.data.target));
    return this.requestRound();
  },

  retryRound() {
    if (this.data.preparing || !['idle', 'early', 'invalid', 'result'].includes(this.data.status)) return;
    return this.requestRound();
  },

  async requestRound() {
    if (this.data.preparing) return;
    const request = ++this._roundRequest;
    this.setData({ preparing: true, error: '' });
    try {
      const delay = await getRandomWait(this._secureSource);
      if (request !== this._roundRequest) return;
      this.setData({ preparing: false });
      this.machine.beginRound(delay);
    } catch (error) {
      if (request === this._roundRequest) this.setData({ preparing: false, error: '安全随机数获取失败，请更新微信后重试' });
    }
  },

  onMachineState(snapshot) {
    const copy = {
      status: snapshot.status,
      target: snapshot.target,
      scores: snapshot.scores,
      validCount: snapshot.validCount,
      average: snapshot.average,
      best: snapshot.best,
      tier: tierFor(snapshot.average)
    };
    const text = {
      idle: ['点击开始', snapshot.validCount ? '点击继续下一轮，已有成绩保留' : '点击此区域开始，等画面变绿后立即点击'],
      waiting: ['等待变绿…', '别急，绿了再点！提前点击算抢跳'],
      greenPending: ['现在点！', '立即点击绿色区域'],
      green: ['现在点！', '立即点击绿色区域'],
      early: ['抢跳了', '本次不计成绩，点击此处重试'],
      invalid: ['本次作废', '超过 10 秒未响应，点击此处重试'],
      result: [`${snapshot.scores[snapshot.scores.length - 1]} ms`, '本轮有效，点击此处进入下一轮'],
      complete: [`平均 ${snapshot.average} ms`, `最佳单轮 ${snapshot.best} ms，点击重新测试`]
    }[snapshot.status];
    copy.statusTitle = text[0];
    copy.statusHint = text[1];
    if (snapshot.status === 'greenPending') {
      this.setData(copy, () => this.machine.markGreenRendered(snapshot.token));
      return;
    }
    this.setData(copy);
    if (snapshot.status === 'complete') this.savePersonalBest(snapshot);
  },

  onPadTouchStart() {
    if (!this.machine || this.data.preparing) return;
    if (this.data.status === 'complete') return this.startTest();
    if (['idle', 'early', 'invalid', 'result'].includes(this.data.status)) return this.retryRound();
    this.machine.press();
  },

  savePersonalBest(snapshot) {
    const signature = `${snapshot.target}:${snapshot.scores.join(',')}`;
    if (signature === this._savedSignature) return;
    this._savedSignature = signature;
    const personalBest = mergePersonalBest(this.data.personalBest, snapshot);
    try {
      wx.setStorageSync(STORAGE_KEY, personalBest);
      this.setData({ personalBest, ...bestDisplay(personalBest) });
    } catch (error) {
      this.setData({ error: '个人最好成绩暂时无法保存' });
    }
  },

  clearPersonalBest() {
    if (this.data.preparing || ['waiting', 'greenPending', 'green'].includes(this.data.status)) return;
    wx.showModal({
      title: '清除个人最好',
      content: '将清除本机保存的 3、5、10 轮平均与单轮最佳，是否继续？',
      confirmText: '清除',
      confirmColor: '#D64C4C',
      success: result => {
        if (!result.confirm) return;
        try {
          wx.removeStorageSync(STORAGE_KEY);
          this._savedSignature = '';
          const personalBest = { averages: {}, single: null };
          this.setData({ personalBest, ...bestDisplay(personalBest) });
        } catch (error) {
          wx.showToast({ title: '清除失败，请重试', icon: 'none' });
        }
      }
    });
  },

  cancelActive() {
    this._roundRequest++;
    if (this.machine) this.machine.cancelActive();
    if (this.data.preparing) this.setData({ preparing: false });
  },

  onHide() { this.cancelActive(); },
  onUnload() { this.cancelActive(); }
});
