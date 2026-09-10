const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');

const COLORS = [
  { value: '#FFFFFF', title: '白色' }, { value: '#FFE45C', title: '明黄' },
  { value: '#FFB34E', title: '橙色' }, { value: '#FF6B6B', title: '红色' },
  { value: '#FF7AAE', title: '粉色' }, { value: '#D7A7FF', title: '紫色' },
  { value: '#7FA8FF', title: '蓝色' }, { value: '#69E2FF', title: '青色' },
  { value: '#5CFFB0', title: '绿色' }, { value: '#C8FF62', title: '青柠' },
  { value: '#E8EEF6', title: '银灰' }, { value: '#141A23', title: '黑色' }
];
const BACKGROUNDS = [
  { value: '#05070A', title: '曜石黑' }, { value: '#172033', title: '深海蓝' },
  { value: '#103D4B', title: '墨青' }, { value: '#174633', title: '森林绿' },
  { value: '#40204A', title: '深紫' }, { value: '#5A1E35', title: '酒红' },
  { value: '#71351D', title: '赤陶' }, { value: '#7A5B10', title: '深金' },
  { value: '#3157A4', title: '钴蓝' }, { value: '#7542A8', title: '亮紫' },
  { value: '#DCE5F0', title: '雾灰' }, { value: '#FFFFFF', title: '白色' }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hexToHsv(hex) {
  const value = String(hex || '#FFFFFF').replace('#', '');
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max ? delta / max * 100 : 0, brightness: max * 100 };
}

function hsvToHex(hue, saturation, brightness) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const v = clamp(brightness, 0, 100) / 100;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const match = v - chroma;
  let red = 0; let green = 0; let blue = 0;
  if (h < 60) { red = chroma; green = x; }
  else if (h < 120) { red = x; green = chroma; }
  else if (h < 180) { green = chroma; blue = x; }
  else if (h < 240) { green = x; blue = chroma; }
  else if (h < 300) { red = x; blue = chroma; }
  else { red = chroma; blue = x; }
  const toHex = item => Math.round((item + match) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function pickerState(color) {
  const hsv = hexToHsv(color);
  return {
    hue: hsv.hue,
    saturation: hsv.saturation,
    brightness: hsv.brightness,
    pickerHueColor: hsvToHex(hsv.hue, 100, 100),
    pickerColor: hsvToHex(hsv.hue, hsv.saturation, hsv.brightness),
    pickerAreaLeft: `${hsv.saturation}%`,
    pickerAreaTop: `${100 - hsv.brightness}%`,
    hueLeft: `${hsv.hue / 360 * 100}%`
  };
}

function buildVerticalGlyphs(text) {
  return Array.from(String(text || '')).map((character, index) => ({
    id: index,
    value: character === '\n' ? '\u3000' : character
  }));
}

Page({
  data: {
    text: '', previewText: '极团工具箱', verticalGlyphs: buildVerticalGlyphs('极团工具箱'), colors: COLORS, backgrounds: BACKGROUNDS,
    color: COLORS[1].value, background: BACKGROUNDS[0].value, speed: 12, fontSize: 96,
    scrollAxis: 'horizontal', direction: 'left', running: false, paused: false, showHint: false,
    statusBarHeight: 20, navBarHeight: 44, navTotalHeight: 64,
    pickerOpen: false, pickerTarget: 'color', pickerTitle: '自定义文字颜色',
    ...pickerState(COLORS[1].value)
  },
  onLoad() {
    let statusBarHeight = 20;
    let navBarHeight = 44;
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = Number(windowInfo.statusBarHeight) || statusBarHeight;
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      if (menu && menu.height && menu.top >= statusBarHeight) navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    } catch (_) {}
    this.setData({ statusBarHeight, navBarHeight, navTotalHeight: statusBarHeight + navBarHeight });
  },
  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ visible: false });
  },
  onHide() { if (this.data.running) this.stopDisplay(); },
  onUnload() { this.clearTimers(); this.setSystemBarForBackground('#F7F9FC'); this.releaseScreen(); },
  onShareAppMessage() { return getShareAppMessage({ path: '/package-life/pages/marquee/marquee' }); },
  onShareTimeline() { return getShareTimeline(); },
  goBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },
  onInput(event) {
    const text = String(event.detail.value || '');
    const previewText = text.trim() || '极团工具箱';
    this.setData({ text, previewText, verticalGlyphs: buildVerticalGlyphs(previewText) });
  },
  selectColor(event) {
    const target = event.currentTarget.dataset.target;
    const value = event.currentTarget.dataset.value;
    if (!value || !['color', 'background'].includes(target)) return;
    this.setData({ [target]: value, pickerOpen: false });
  },
  openColorPicker(event) {
    const target = event.currentTarget.dataset.target === 'background' ? 'background' : 'color';
    const color = this.data[target];
    this.setData({
      pickerOpen: true,
      pickerTarget: target,
      pickerTitle: target === 'background' ? '自定义背景颜色' : '自定义文字颜色',
      ...pickerState(color)
    });
  },
  closeColorPicker() { this.setData({ pickerOpen: false }); },
  updatePicker(hue, saturation, brightness) {
    const color = hsvToHex(hue, saturation, brightness);
    const target = this.data.pickerTarget;
    this.setData({ [target]: color, ...pickerState(color) });
  },
  onPickerAreaTouch(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    wx.createSelectorQuery().select('#marqueePickerArea').boundingClientRect(rect => {
      if (!rect || !rect.width || !rect.height) return;
      const saturation = clamp((touch.clientX - rect.left) / rect.width * 100, 0, 100);
      const brightness = clamp(100 - (touch.clientY - rect.top) / rect.height * 100, 0, 100);
      this.updatePicker(this.data.hue, saturation, brightness);
    }).exec();
  },
  onHueTouch(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    wx.createSelectorQuery().select('#marqueeHueSlider').boundingClientRect(rect => {
      if (!rect || !rect.width) return;
      const hue = clamp((touch.clientX - rect.left) / rect.width * 360, 0, 359);
      this.updatePicker(hue, this.data.saturation, this.data.brightness);
    }).exec();
  },
  changeSpeed(event) { this.setData({ speed: Number(event.detail.value) }); },
  changeFontSize(event) { this.setData({ fontSize: Number(event.detail.value) }); },
  selectAxis(event) {
    const scrollAxis = event.currentTarget.dataset.value;
    if (!['horizontal', 'vertical'].includes(scrollAxis)) return;
    this.setData({ scrollAxis, direction: scrollAxis === 'vertical' ? 'up' : 'left' });
  },
  selectDirection(event) { this.setData({ direction: event.currentTarget.dataset.value }); },
  startDisplay() {
    const text = this.data.text.trim();
    if (!text) return wx.showToast({ title: '请先输入弹幕文字', icon: 'none' });
    this.setData({ running: true, paused: false, showHint: true, previewText: text, verticalGlyphs: buildVerticalGlyphs(text), pickerOpen: false });
    this.scheduleHintHide();
    this.setSystemBarForBackground(this.data.background);
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: true });
  },
  handleStageTap() {
    const now = Date.now();
    if (this._tapTimer && now - this._lastTapAt <= 320) {
      clearTimeout(this._tapTimer);
      this._tapTimer = null;
      this._lastTapAt = 0;
      this.stopDisplay();
      return;
    }
    this._lastTapAt = now;
    this._tapTimer = setTimeout(() => {
      this._tapTimer = null;
      this.togglePause();
    }, 320);
  },
  togglePause() {
    if (!this.data.running) return;
    const paused = !this.data.paused;
    this.setData({ paused, showHint: true });
    if (!paused) this.scheduleHintHide();
  },
  scheduleHintHide() {
    if (this._hintTimer) clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this._hintTimer = null;
      if (this.data.running && !this.data.paused) this.setData({ showHint: false });
    }, 2200);
  },
  stopDisplay() {
    this.clearTimers();
    this.setData({ running: false, paused: false, showHint: false });
    this.setSystemBarForBackground('#F7F9FC');
    this.releaseScreen();
  },
  clearTimers() {
    if (this._tapTimer) clearTimeout(this._tapTimer);
    if (this._hintTimer) clearTimeout(this._hintTimer);
    this._tapTimer = null;
    this._hintTimer = null;
    this._lastTapAt = 0;
  },
  setSystemBarForBackground(color) {
    if (!wx.setNavigationBarColor) return;
    const value = String(color || '#000000').replace('#', '');
    const red = parseInt(value.slice(0, 2), 16) || 0;
    const green = parseInt(value.slice(2, 4), 16) || 0;
    const blue = parseInt(value.slice(4, 6), 16) || 0;
    const frontColor = red * 0.299 + green * 0.587 + blue * 0.114 > 170 ? '#000000' : '#ffffff';
    wx.setNavigationBarColor({ frontColor, backgroundColor: color, animation: { duration: 0, timingFunc: 'linear' } });
  },
  releaseScreen() { if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false }); }
});
