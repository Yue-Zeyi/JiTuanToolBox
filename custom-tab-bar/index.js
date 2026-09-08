Component({
  data: {
    visible: true,
    selected: 0,
    list: [
      { text: '首页', icon: 'home', activeIcon: 'home-active', pagePath: '/pages/index/index' },
      { text: '记录', icon: 'history', activeIcon: 'history-active', pagePath: '/pages/history/history' },
      { text: '我的', icon: 'profile', activeIcon: 'profile-active', pagePath: '/pages/profile/profile' }
    ]
  },

  lifetimes: {
    attached() { this.syncSelected(); }
  },

  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const route = pages.length ? `/${pages[pages.length - 1].route}` : '';
      const selected = this.data.list.findIndex(item => item.pagePath === route);
      this.setData({ selected: selected < 0 ? 0 : selected });
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (!item || index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({ url: item.pagePath });
    }
  }
});
