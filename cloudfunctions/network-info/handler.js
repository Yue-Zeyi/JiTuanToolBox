const { isIP } = require('net');
const APP_ID = 'wxc4716148be4731f9';

function getNetworkInfo(context) {
  if (!context || context.APPID !== APP_ID || !context.OPENID) return { ok: false, code: 'UNAUTHORIZED', message: '请从极团工具箱小程序内查询' };
  const addresses = [];
  if (isIP(context.CLIENTIP || '') === 4) addresses.push({ ip: context.CLIENTIP, version: 'IPv4' });
  if (isIP(context.CLIENTIPV6 || '') === 6) addresses.push({ ip: context.CLIENTIPV6, version: 'IPv6' });
  if (!addresses.length) return { ok: false, code: 'ADDRESS_UNAVAILABLE', message: '微信暂未提供当前连接地址，请在手机端重试' };
  return { ok: true, addresses, checkedAt: Date.now() };
}

module.exports = { getNetworkInfo };
