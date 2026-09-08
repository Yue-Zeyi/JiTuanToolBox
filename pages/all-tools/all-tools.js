const app = getApp();
const { toolCategories, getTool, getToolGroups } = require('../../utils/tool-catalog');
const { track } = require('../../utils/analytics');
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');

Page({
  data: {
    categories: toolCategories,
    activeCategory: 'all',
    query: '',
    isSearching: false,
    groups: getToolGroups(),
    emptyKind: '',
    scrollTop: 0,
    keyboardHeight: 0
  },

  onLoad() {
    this._activeCategory = 'all';
    this._scrollTop = 0;
    this._browseScrollTop = 0;
    this._searching = false;
    this._viewRevision = 0;
  },

  onShow() {
    this._opening = false;
  },

  onListScroll(event) {
    this._scrollTop = event.detail.scrollTop;
  },

  updateView(query, activeCategory, scrollTop = 0) {
    const groups = getToolGroups(activeCategory, query);
    const isSearching = Boolean(query.trim());
    const hasTools = groups.some(group => group.tools.length);
    const revision = ++this._viewRevision;
    const previousScrollTop = this._scrollTop;
    this._activeCategory = activeCategory;
    this._scrollTop = scrollTop;
    // Sync the physical scroll offset before requesting a reset to the same bound value.
    this.setData({ scrollTop: previousScrollTop }, () => {
      if (revision !== this._viewRevision) return;
      this.setData({ query, activeCategory, isSearching, groups, scrollTop, emptyKind: hasTools ? '' : (isSearching ? 'search' : 'category') });
    });
  },

  selectCategory(event) {
    const category = event.currentTarget.dataset.category;
    if (!toolCategories.some(item => item.key === category)) return;
    this.dismissKeyboard();
    this._searching = false;
    this._browseScrollTop = 0;
    this.updateView('', category);
  },

  onSearchInput(event) {
    const query = event.detail.value;
    const searching = Boolean(query.trim());
    if (!this._searching && searching) this._browseScrollTop = this._scrollTop;
    const scrollTop = this._searching && !searching ? this._browseScrollTop : 0;
    this._searching = searching;
    this.updateView(query, this._activeCategory, scrollTop);
  },

  clearSearch() {
    this.onSearchInput({ detail: { value: '' } });
  },

  showAllCategories() {
    this.selectCategory({ currentTarget: { dataset: { category: 'all' } } });
  },

  onKeyboardHeightChange(event) {
    this.setData({ keyboardHeight: Math.max(0, event.detail.height || 0) });
  },

  dismissKeyboard() {
    wx.hideKeyboard();
  },

  openTool(event) {
    const tool = getTool(event.currentTarget.dataset.key);
    if (!tool || this._opening) return;
    this._opening = true;
    this.dismissKeyboard();
    wx.navigateTo({
      url: tool.page,
      success: () => {
        app.recordRecent(tool);
        track('tool_open', { tool: tool.key });
      },
      fail: () => {
        this._opening = false;
        wx.showToast({ title: '暂时无法打开，请稍后重试', icon: 'none' });
      }
    });
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: '/pages/all-tools/all-tools' });
  },

  onShareTimeline() {
    return getShareTimeline();
  }
});
