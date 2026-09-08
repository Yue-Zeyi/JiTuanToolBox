const { CITIES } = require('./world-cities');
const formatters = new Map();
const zoneNames = new Map();
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function requireIntl() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    throw new Error('当前微信版本不支持完整时区计算，请升级微信后重试');
  }
}

function getLocalZone() {
  requireIntl();
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) throw new Error('无法读取本地时区，请检查设备时区设置');
  return zone;
}

function getParts(instant, zone) {
  requireIntl();
  if (!formatters.has(zone)) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', hour12: false
    });
    if (typeof formatter.formatToParts !== 'function') throw new Error('当前微信版本不支持完整时区计算，请升级微信后重试');
    formatters.set(zone, formatter);
  }
  const parts = {};
  formatters.get(zone).formatToParts(new Date(instant)).forEach(part => {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  });
  // Some older ICU versions format midnight as 24 even with a 24-hour cycle.
  if (parts.hour === 24) parts.hour = 0;
  if (!['year', 'month', 'day', 'hour', 'minute', 'second'].every(key => Number.isFinite(parts[key]))) {
    throw new Error('设备时区数据不可用，请升级微信后重试');
  }
  return parts;
}

function offsetAt(instant, parts) {
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(instant / 1000) * 1000) / 60000);
}

function offsetLabel(minutes) {
  const absolute = Math.abs(minutes);
  return `UTC${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function getDst(instant, zone) {
  // Intl exposes names, not tzdb's isdst flag. Negative-DST conventions are ambiguous.
  if (['Europe/Dublin', 'Eire', 'Africa/Casablanca', 'Africa/El_Aaiun'].includes(zone)) return null;
  try {
    if (!zoneNames.has(zone)) zoneNames.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }));
    const name = zoneNames.get(zone).formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName');
    if (name && /daylight|summer/i.test(name.value)) return true;
    if (name && /standard/i.test(name.value)) return false;
  } catch (error) { return null; }
  return null;
}

function getClock(instant, zone, localZone) {
  if (!Number.isFinite(instant)) throw new Error('无效时间');
  const parts = getParts(instant, zone);
  const offsetMinutes = offsetAt(instant, parts);
  const localOffset = zone === localZone ? offsetMinutes : offsetAt(instant, getParts(instant, localZone));
  const differenceMinutes = offsetMinutes - localOffset;
  const absolute = Math.abs(differenceMinutes);
  const differenceLabel = differenceMinutes === 0 ? '与本地相同' : `比本地${differenceMinutes > 0 ? '快' : '慢'} ${Math.floor(absolute / 60)} 小时${absolute % 60 ? ` ${absolute % 60} 分` : ''}`;
  const pad = value => String(value).padStart(2, '0');
  const status = parts.hour >= 9 && parts.hour < 18 ? 'working' : parts.hour >= 7 && parts.hour < 23 ? 'awake' : 'rest';
  const dst = getDst(instant, zone);
  return {
    time: `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    weekday: WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()],
    offsetMinutes, offsetLabel: offsetLabel(offsetMinutes), differenceMinutes, differenceLabel,
    dst, dstLabel: dst === true ? '夏令时' : dst === false ? '标准时间' : '夏令时无法判定',
    status, statusLabel: { working: '工作', awake: '清醒', rest: '休息' }[status]
  };
}

function searchCities(query) {
  const text = String(query || '').trim().toLowerCase();
  return CITIES.filter(city => !text || `${city.name} ${city.country} ${city.english} ${city.id} ${city.zone}`.toLowerCase().includes(text));
}

module.exports = { getClock, getLocalZone, searchCities };
