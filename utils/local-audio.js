function audioError(value) {
  const message = value && value.errMsg ? value.errMsg : '音频播放失败';
  const error = new Error(message);
  if (value && value.errCode !== undefined) error.code = value.errCode;
  return error;
}

function createLocalAudioPlayer(options = {}) {
  const wxApi = options.wxApi || (typeof wx === 'undefined' ? null : wx);
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const src = String(options.src || '').trim();
  if (!wxApi || typeof wxApi.createInnerAudioContext !== 'function' || !src) {
    onError(new Error('当前设备不支持本地音频'));
    return null;
  }

  if (typeof wxApi.setInnerAudioOption === 'function') {
    try {
      wxApi.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: false, speakerOn: true, fail: () => {} });
    } catch (error) {}
  }
  const audio = wxApi.createInnerAudioContext();
  const volume = Math.max(0, Math.min(1, Number(options.volume) || 0.8));
  let primeTimer = null;
  let destroyed = false;
  const reportError = value => {
    if (destroyed) return;
    const error = value instanceof Error ? value : audioError(value);
    console.warn('[local-audio]', src, error.code || '', error.message);
    onError(error);
  };

  audio.autoplay = false;
  audio.loop = Boolean(options.loop);
  audio.volume = volume;
  // 提醒类工具使用媒体音量播放，不受 iPhone 侧边静音键影响。
  audio.obeyMuteSwitch = false;
  audio.mixWithOther = true;
  if (typeof audio.onError === 'function') audio.onError(reportError);
  audio.src = src;

  const clearPrime = () => {
    if (primeTimer !== null) clearTimeout(primeTimer);
    primeTimer = null;
  };
  const restart = () => {
    if (destroyed) return false;
    try {
      audio.stop();
      audio.play();
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  return {
    play() {
      clearPrime();
      audio.volume = volume;
      return restart();
    },
    prime() {
      clearPrime();
      audio.volume = 0;
      if (!restart()) return false;
      primeTimer = setTimeout(() => {
        primeTimer = null;
        try { audio.stop(); } catch (error) {}
        audio.volume = volume;
      }, 120);
      return true;
    },
    stop() {
      clearPrime();
      try { audio.stop(); } catch (error) {}
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearPrime();
      try { audio.stop(); } catch (error) {}
      try { audio.destroy(); } catch (error) {}
    }
  };
}

module.exports = { createLocalAudioPlayer };
