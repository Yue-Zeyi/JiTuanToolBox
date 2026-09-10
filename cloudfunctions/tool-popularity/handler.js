const APP_ID = 'wxc4716148be4731f9';
const TOOL_KEYS = new Set([
  'tax-calculator', 'json-format', 'mortgage', 'bmi', 'compress', 'resize', 'pdf', 'watermark', 'split', 'stitch',
  'image-format', 'image-transform', 'base64', 'url-codec', 'image-exif', 'image-picker', 'regex-test', 'color-query',
  'user-agent', 'http-status', 'unicode-query', 'lunar-convert', 'plate-query', 'word-count', 'text-clean', 'text-compare',
  'fancy-font', 'password', 'zodiac', 'chinese-convert', 'qrcode', 'ip-query', 'decision', 'coin', 'reaction', 'breathing',
  'marquee', 'metronome', 'timestamp', 'radix', 'unit-converter', 'scientific-calculator', 'percentage', 'date-calculator',
  'world-clock', 'constellation', 'age-query', 'date-info', 'stopwatch', 'countdown'
]);

function createPopularityHandler(dependencies) {
  const { increment, getTop } = dependencies;
  return async (event = {}, context = {}) => {
    if (context.APPID !== APP_ID || !context.OPENID) return { ok: false, code: 'UNAUTHORIZED' };
    if (event.action === 'increment') {
      const toolKey = String(event.toolKey || '');
      if (!TOOL_KEYS.has(toolKey)) return { ok: false, code: 'INVALID_TOOL' };
      await increment(toolKey);
      return { ok: true };
    }
    if (event.action === 'top') {
      const limit = Math.max(1, Math.min(6, Math.floor(Number(event.limit)) || 6));
      const items = await getTop(limit);
      return { ok: true, items: items.filter(item => TOOL_KEYS.has(item.key)).slice(0, limit) };
    }
    return { ok: false, code: 'INVALID_ACTION' };
  };
}

module.exports = { APP_ID, TOOL_KEYS, createPopularityHandler };
