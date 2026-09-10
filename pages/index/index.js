const app = getApp();
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { catalogTools, getTool } = require('../../utils/tool-catalog');
const { reportToolClick, fetchPopularToolKeys } = require('../../utils/tool-popularity');

const defaultTools = catalogTools.filter(tool => tool.homeFeatured);
const toolCount = catalogTools.length;

function resolvePopularTools(keys = []) {
  const result = [];
  const used = new Set();
  const append = tool => {
    if (!tool || tool.comingSoon || used.has(tool.key) || result.length >= 6) return;
    used.add(tool.key);
    result.push(tool);
  };
  keys.forEach(key => append(getTool(key)));
  defaultTools.forEach(append);
  catalogTools.forEach(append);
  return result;
}

function pickRecommendations(previousKeys = []) {
  const available = catalogTools.filter(tool => !tool.comingSoon);
  const previous = new Set(previousKeys);
  let pool = available.filter(tool => !previous.has(tool.key));
  if (pool.length < 4) pool = available.slice();
  for (let index = 0; index < 4; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (pool.length - index));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, 4);
}

Page({
  data: { tools: defaultTools, toolCount, recent: [], recommendations: [] },

  onLoad() {
    this.setData({ recommendations: pickRecommendations() });
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) { tabBar.setData({ visible: true }); tabBar.syncSelected(); }
    const recent = wx.getStorageSync(app.globalData.recentKey) || [];
    this.setData({ recent: Array.isArray(recent) ? recent.slice(0, 6) : [] });
    this.loadPopularTools();
  },

  async loadPopularTools() {
    const revision = (this._popularityRevision || 0) + 1;
    this._popularityRevision = revision;
    const keys = await fetchPopularToolKeys(6);
    if (revision !== this._popularityRevision || !keys.length) return;
    this.setData({ tools: resolvePopularTools(keys) });
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/index/index' });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  openTool(event) {
    const key = event.currentTarget.dataset.key;
    const target = getTool(key);
    if (!target) return;
    if (target.comingSoon) return wx.showToast({ title: '工具即将上线，敬请期待', icon: 'none' });
    wx.navigateTo({
      url: target.page,
      success: () => this.recordToolOpen(target),
      fail: () => wx.showToast({ title: '暂时无法打开，请稍后重试', icon: 'none' })
    });
  },

  openRecommendation(event) {
    this.openTool(event);
  },

  refreshRecommendations() {
    const previousKeys = this.data.recommendations.map(tool => tool.key);
    this.setData({ recommendations: pickRecommendations(previousKeys) });
  },

  showAllTools() {
    wx.navigateTo({ url: '/pages/all-tools/all-tools' });
  },

  openRecent(event) {
    const target = this.data.recent[event.currentTarget.dataset.index];
    if (!target) return;
    wx.navigateTo({
      url: target.page,
      success: () => this.recordToolOpen(target),
      fail: () => wx.showToast({ title: '暂时无法打开，请稍后重试', icon: 'none' })
    });
  },

  recordToolOpen(target) {
    app.recordRecent(target);
    reportToolClick(target.key);
    track('tool_open', { tool: target.key });
  },

  onUnload() { this._popularityRevision = (this._popularityRevision || 0) + 1; },

  onNav(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'home') return;
    if (target === 'history') return wx.switchTab({ url: '/pages/history/history' });
    if (target === 'profile') return wx.switchTab({ url: '/pages/profile/profile' });
  }
});
