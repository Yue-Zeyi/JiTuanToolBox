const runtime = require('../config/runtime');
const { isDevtools } = require('./platform');

const CONSENT_KEY = 'jituan_privacy_consent';

function hasConsent() {
  return typeof wx !== 'undefined' && wx.getStorageSync(CONSENT_KEY) === runtime.privacyVersion;
}

function requestSystemPrivacy() {
  // 新版微信会在调用相册/媒体接口前要求官方隐私授权；旧基础库没有这些 API 时直接兼容通过。
  if (typeof wx === 'undefined' || typeof wx.getPrivacySetting !== 'function' || typeof wx.requirePrivacyAuthorize !== 'function') return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    try {
      wx.getPrivacySetting({
        success: setting => {
          if (!setting || !setting.needAuthorization) return finish(true);
          try {
            wx.requirePrivacyAuthorize({
              success: () => finish(true),
              fail: error => {
                const reason = error && error.errMsg ? error.errMsg : '';
                // 用户明确拒绝时停止；未配置隐私指引、接口不支持等环境错误交给相册 API 自己处理。
                finish(/cancel|reject|deny|拒绝|取消/i.test(reason) ? false : true);
              }
            });
          } catch (error) {
            // 未配置隐私指引或旧版本实现异常时，不要让点击事件静默中断；交给选图失败回调给出具体提示。
            finish(true);
          }
        },
        fail: () => finish(true)
      });
    } catch (error) {
      finish(true);
    }
  });
}

function requestConsent() {
  if (isDevtools()) {
    wx.setStorageSync(CONSENT_KEY, runtime.privacyVersion);
    return Promise.resolve(true);
  }
  const ownConsent = hasConsent()
    ? Promise.resolve(true)
    : new Promise(resolve => {
      try {
        wx.showModal({
          title: '使用前隐私提示',
          content: '极团工具箱会将你主动选择的图片临时提交至微信官方内容安全服务检测；检测通过后，本地工具在设备本地处理，线上工具按页面说明发送完成任务所必需的文件。继续使用即表示你已阅读隐私说明。',
          confirmText: '同意并继续',
          cancelText: '暂不使用',
          success: result => {
            if (result.confirm) wx.setStorageSync(CONSENT_KEY, runtime.privacyVersion);
            resolve(result.confirm);
          },
          fail: error => {
            // 真机预览中如果弹窗接口被系统/已有弹层拦截，不能把选图功能静默锁死；让微信自己的相册权限流程继续处理。
            console.warn('privacy modal unavailable', error);
            resolve(true);
          }
        });
      } catch (error) {
        console.warn('privacy modal error', error);
        resolve(true);
      }
    });
  return ownConsent.then(confirmed => {
    if (!confirmed) {
      wx.showToast({ title: '同意隐私提示后才能选择图片', icon: 'none' });
      return false;
    }
    return requestSystemPrivacy().then(authorized => {
      if (!authorized) wx.showToast({ title: '请先同意微信隐私保护指引', icon: 'none' });
      return authorized;
    });
  }).catch(() => {
    wx.showToast({ title: '隐私授权异常，请重新进入页面', icon: 'none' });
    return false;
  });
}

function clearConsent() {
  if (typeof wx !== 'undefined') wx.removeStorageSync(CONSENT_KEY);
}

module.exports = { hasConsent, requestConsent, clearConsent };
