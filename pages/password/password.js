const app = getApp();
const { getShareAppMessage, getShareTimeline } = require('../../utils/share');
const { MIN_LENGTH, MAX_LENGTH, MAX_COUNT, CHARACTER_TYPES, DEFAULT_SETTINGS, prepareSettings, createWechatRandomSource, generatePasswords } = require('../../utils/password');

const PASSWORD_TOOL = { key: 'password', title: '随机密码', desc: '按需生成安全随机密码', icon: 'password', tone: 'blue', page: '/pages/password/password' };
const createTypes = keys => CHARACTER_TYPES.map(type => ({ key: type.key, title: type.title, sample: type.sample, active: keys.includes(type.key) }));

Page({
  data: {
    minLength: MIN_LENGTH,
    maxLength: MAX_LENGTH,
    maxCount: MAX_COUNT,
    length: DEFAULT_SETTINGS.length,
    count: DEFAULT_SETTINGS.count,
    types: createTypes(DEFAULT_SETTINGS.types),
    include: '',
    exclude: '',
    passwords: [],
    resultLength: 0,
    generating: false,
    saving: false,
    saved: false,
    error: ''
  },

  onLoad(options) {
    this.unloaded = false;
    if (!options || !options.recordId) return;
    let record;
    try {
      record = app.getOperationRecord(decodeURIComponent(options.recordId));
      if (!record || record.key !== 'password' || !Array.isArray(record.passwords)) return;
      const { settings } = prepareSettings(record.passwordSettings);
      if (record.passwords.length !== settings.count || record.passwords.some(value => typeof value !== 'string' || value.length !== settings.length || /[^\x21-\x7E]/.test(value))) return;
      this.resultSettings = settings;
      this.setData({ length: settings.length, count: settings.count, types: createTypes(settings.types), include: settings.include, exclude: settings.exclude, passwords: record.passwords.slice(), resultLength: settings.length, saved: true });
    } catch (error) {
      wx.showToast({ title: '该密码记录无法恢复', icon: 'none' });
    }
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) tabBar.setData({ visible: false });
  },

  onUnload() {
    this.unloaded = true;
  },

  onShareAppMessage() {
    return getShareAppMessage({ path: PASSWORD_TOOL.page });
  },

  onShareTimeline() {
    return getShareTimeline();
  },

  onLengthInput(event) {
    this.setData({ length: event.detail.value, error: '' });
  },

  onLengthSlide(event) {
    this.setData({ length: event.detail.value, error: '' });
  },

  onCountInput(event) {
    this.setData({ count: event.detail.value, error: '' });
  },

  onIncludeInput(event) {
    this.setData({ include: event.detail.value, error: '' });
  },

  onExcludeInput(event) {
    this.setData({ exclude: event.detail.value, error: '' });
  },

  toggleType(event) {
    if (this.data.generating || this.data.saving) return;
    const key = event.currentTarget.dataset.key;
    const selected = this.data.types.find(type => type.key === key);
    if (!selected) return;
    if (selected.active && this.data.types.filter(type => type.active).length === 1) return wx.showToast({ title: '至少保留一种字符类型', icon: 'none' });
    this.setData({ types: this.data.types.map(type => type.key === key ? { ...type, active: !type.active } : type), error: '' });
  },

  async generate() {
    if (this.data.generating || this.data.saving) return;
    let settings;
    try {
      settings = prepareSettings({ length: this.data.length, count: this.data.count, types: this.data.types.filter(type => type.active).map(type => type.key), include: this.data.include, exclude: this.data.exclude }).settings;
    } catch (error) {
      this.setData({ error: error.message });
      return;
    }
    this.setData({ generating: true, error: '' });
    try {
      const passwords = await generatePasswords(settings, createWechatRandomSource(wx));
      if (this.unloaded) return;
      this.resultSettings = settings;
      this.setData({ passwords, resultLength: settings.length, saved: false });
    } catch (error) {
      if (!this.unloaded) this.setData({ error: '安全随机数获取失败，请更新微信后重试' });
    } finally {
      if (!this.unloaded) this.setData({ generating: false });
    }
  },

  copyOne(event) {
    const value = this.data.passwords[Number(event.currentTarget.dataset.index)];
    if (value) this.copyText(value);
  },

  copyAll() {
    if (this.data.passwords.length) this.copyText(this.data.passwords.join('\n'));
  },

  copyText(data) {
    wx.setClipboardData({ data, success: () => wx.showToast({ title: '已复制' }), fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) });
  },

  clearResults() {
    if (this.data.generating || this.data.saving) return;
    this.resultSettings = null;
    this.setData({ passwords: [], resultLength: 0, saved: false, error: '' });
  },

  saveRecord() {
    if (this.data.generating || this.data.saving || this.data.saved || !this.data.passwords.length || !this.resultSettings) return;
    const passwords = this.data.passwords.slice();
    const passwordSettings = { ...this.resultSettings, types: this.resultSettings.types.slice() };
    this.setData({ saving: true });
    wx.showModal({
      title: '保存密码记录',
      content: '密码将以明文保存在本机操作记录中，可再次查看。这不是密码保险箱，请勿保存重要账户密码。是否继续？',
      confirmText: '确认保存',
      confirmColor: '#2F80ED',
      success: async result => {
        if (!result.confirm || this.unloaded) {
          if (!this.unloaded) this.setData({ saving: false });
          return;
        }
        try {
          await app.recordOperation({ ...PASSWORD_TOOL, modeLabel: `${passwords.length} 条密码`, detailText: `每条 ${passwordSettings.length} 位`, passwords, passwordSettings });
          if (!this.unloaded) {
            this.setData({ saved: true });
            wx.showToast({ title: '已保存到操作记录' });
          }
        } catch (error) {
          if (!this.unloaded) wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        } finally {
          if (!this.unloaded) this.setData({ saving: false });
        }
      },
      fail: () => {
        if (!this.unloaded) {
          this.setData({ saving: false });
          wx.showToast({ title: '暂时无法保存，请重试', icon: 'none' });
        }
      }
    });
  }
});
