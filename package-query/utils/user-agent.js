function matchVersion(ua, expression) {
  const match = ua.match(expression);
  return match ? match[1].replace(/_/g, '.') : '';
}

function parseUserAgent(value) {
  const ua = String(value || '').trim();
  if (!ua) throw new Error('请输入需要解析的 User-Agent');
  if (ua.length > 2000) throw new Error('User-Agent 最多输入 2000 个字符');
  const bot = /bot|crawler|spider|slurp|bingpreview|headless/i.test(ua);
  let browser = '未知浏览器'; let browserVersion = '';
  const browsers = [
    ['Edge', /EdgA?\/([\d.]+)/i], ['Opera', /(?:OPR|Opera)\/([\d.]+)/i],
    ['微信', /MicroMessenger\/([\d.]+)/i], ['QQ 浏览器', /MQQBrowser\/([\d.]+)/i],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/i], ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/i],
    ['Safari', /Version\/([\d.]+).*Safari/i], ['Internet Explorer', /(?:MSIE\s|rv:)([\d.]+)/i]
  ];
  for (const item of browsers) { const version = matchVersion(ua, item[1]); if (version) { browser = item[0]; browserVersion = version; break; } }
  if (bot) browser = '自动化程序 / 爬虫';

  let os = '未知系统'; let osVersion = '';
  if (/HarmonyOS/i.test(ua)) { os = 'HarmonyOS'; osVersion = matchVersion(ua, /HarmonyOS[\s\/]([\d.]+)/i); }
  else if (/Windows NT/i.test(ua)) {
    os = 'Windows'; const nt = matchVersion(ua, /Windows NT\s([\d.]+)/i);
    osVersion = ({ '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7' })[nt] || nt;
  } else if (/Android/i.test(ua)) { os = 'Android'; osVersion = matchVersion(ua, /Android\s([\d.]+)/i); }
  else if (/(iPhone|iPad|iPod)/i.test(ua)) { os = /iPad/i.test(ua) ? 'iPadOS' : 'iOS'; osVersion = matchVersion(ua, /OS\s([\d_]+)/i); }
  else if (/Mac OS X/i.test(ua)) { os = 'macOS'; osVersion = matchVersion(ua, /Mac OS X\s([\d_]+)/i); }
  else if (/Linux/i.test(ua)) os = 'Linux';

  const tablet = /iPad|Tablet|Nexus 7|Nexus 9|SM-T|Pad/i.test(ua);
  const mobile = /Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
  const deviceType = bot ? '自动化程序' : tablet ? '平板设备' : mobile ? '手机设备' : '桌面设备';
  let device = deviceType;
  if (/iPhone/i.test(ua)) device = 'Apple iPhone'; else if (/iPad/i.test(ua)) device = 'Apple iPad';
  else { const androidModel = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i); if (androidModel) device = androidModel[1].trim(); }
  const engine = /AppleWebKit/i.test(ua) ? (/Chrome|CriOS|Edg|OPR/i.test(ua) ? 'Blink' : 'WebKit') : /Gecko\//i.test(ua) ? 'Gecko' : /Trident/i.test(ua) ? 'Trident' : '未知';
  const architecture = /(?:x86_64|Win64|x64|amd64)/i.test(ua) ? '64 位 x86' : /(?:arm64|aarch64)/i.test(ua) ? '64 位 ARM' : /(?:i686|x86)/i.test(ua) ? '32 位 x86' : '未标明';
  return { browser, browserVersion: browserVersion || '未标明', os, osVersion: osVersion || '未标明', engine, deviceType, device, architecture, isBot: bot, ua };
}

module.exports = { parseUserAgent };
