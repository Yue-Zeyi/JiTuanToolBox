const app = getApp();
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { catalogTools, getTool } = require('../../utils/tool-catalog');

const tools = catalogTools.filter(tool => tool.homeFeatured);
const toolCount = catalogTools.length;

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
  data: { tools, toolCount, recent: [], recommendations: [] },

  onLoad() {
    this.setData({ recommendations: pickRecommendations() });
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) { tabBar.setData({ visible: true }); tabBar.syncSelected(); }
    const recent = wx.getStorageSync(app.globalData.recentKey) || [];
    this.setData({ recent: Array.isArray(recent) ? recent.slice(0, 4) : [] });
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
    app.recordRecent(target);
    track('tool_open', { tool: target.key });
    wx.navigateTo({ url: target.page });
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
    app.recordRecent(target);
    wx.navigateTo({ url: target.page });
  },

  onNav(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'home') return;
    if (target === 'history') return wx.switchTab({ url: '/pages/history/history' });
    if (target === 'profile') return wx.switchTab({ url: '/pages/profile/profile' });
  }
});
