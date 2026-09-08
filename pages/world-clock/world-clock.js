const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { CITIES } = require('../../utils/world-cities');
const { getClock, getLocalZone, searchCities } = require('../../utils/world-clock');
const DEFAULT_IDS = ['beijing', 'tokyo', 'london', 'new-york'];

Page({
  data: {
    clocks: [], error: '', searchOpen: false, searchText: '', searchResults: [],
    cityCount: CITIES.length, isLive: true, travelMinutes: 0, travelLabel: '当前时间', localZone: ''
  },

  onLoad() {
    this.selectedIds = DEFAULT_IDS.slice();
    this.visible = false;
    this.unloaded = false;
    this.refresh();
  },

  onShow() {
    this.visible = true;
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
    this.refresh();
    this.startClock();
  },

  onHide() { this.visible = false; this.stopClock(); },
  onUnload() { this.unloaded = true; this.visible = false; this.stopClock(); },

  startClock() {
    if (this.visible && this.data.isLive && !this.data.error && !this.clockTimer) {
      this.clockTimer = setInterval(() => this.refresh(), 1000);
    }
  },

  stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  },

  refresh() {
    if (this.unloaded) return;
    try {
      const localZone = getLocalZone();
      const instant = this.data.isLive ? Date.now() : this.travelAnchor + this.data.travelMinutes * 60000;
      const cities = [{ id: 'local', name: '本地时间', country: '设备时区', zone: localZone }, ...this.selectedIds.map(id => CITIES.find(city => city.id === id))];
      const clocks = cities.map(city => ({ ...city, ...getClock(instant, city.zone, localZone) }));
      this.setData({ clocks, localZone, error: '' });
    } catch (error) {
      this.stopClock();
      this.setData({ clocks: [], error: error.message || '设备时区数据不可用，请升级微信后重试' });
    }
  },

  openSearch() {
    this.setData({ searchOpen: true, searchText: '' });
    this.updateSearch();
  },

  closeSearch() { this.setData({ searchOpen: false }); },
  stopPropagation() {},

  onSearch(event) {
    this.setData({ searchText: String(event.detail.value || '') });
    this.updateSearch();
  },

  updateSearch() {
    this.setData({ searchResults: searchCities(this.data.searchText).map(city => ({ ...city, selected: this.selectedIds.includes(city.id) })) });
  },

  addCity(event) {
    const id = event.currentTarget.dataset.id;
    const city = CITIES.find(item => item.id === id);
    if (!city || this.selectedIds.includes(id)) return;
    try {
      getClock(Date.now(), city.zone, getLocalZone());
      this.selectedIds.push(id);
      this.refresh();
      this.updateSearch();
    } catch (error) {
      wx.showToast({ title: '当前设备不支持此城市时区', icon: 'none' });
    }
  },

  removeCity(event) {
    const id = event.currentTarget.dataset.id;
    if (id === 'local') return;
    this.selectedIds = this.selectedIds.filter(value => value !== id);
    this.refresh();
    if (this.data.searchOpen) this.updateSearch();
  },

  onTravel(event) {
    const travelMinutes = Number(event.detail.value);
    if (!Number.isFinite(travelMinutes) || travelMinutes < -1440 || travelMinutes > 1440) return;
    if (this.data.isLive) this.travelAnchor = Date.now();
    this.stopClock();
    const absolute = Math.abs(travelMinutes);
    const travelLabel = travelMinutes === 0 ? '预览起点' : `${travelMinutes < 0 ? '提前' : '延后'} ${Math.floor(absolute / 60)} 小时${absolute % 60 ? ` ${absolute % 60} 分` : ''}`;
    this.setData({ isLive: false, travelMinutes, travelLabel });
    this.refresh();
  },

  resetLive() {
    this.setData({ isLive: true, travelMinutes: 0, travelLabel: '当前时间' });
    this.refresh();
    this.startClock();
  },

  onShareAppMessage() { return getShareAppMessage({ path: '/pages/world-clock/world-clock' }); },
  onShareTimeline() { return getShareTimeline(); }
});
