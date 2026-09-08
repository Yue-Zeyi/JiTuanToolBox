const MAX_ROWS = 100;
const MIN_OFFSET = -12;
const MAX_OFFSET = 14;
const MAX_DATE_MS = 8640000000000000n;

const pad = (value, length = 2) => String(value).padStart(length, '0');

function formatYear(year) {
  if (year >= 0 && year <= 9999) return pad(year, 4);
  return `${year < 0 ? '-' : '+'}${pad(Math.abs(year), 6)}`;
}

function validateOffset(offset) {
  const value = Number(offset);
  if (!Number.isInteger(value) || value < MIN_OFFSET || value > MAX_OFFSET) throw new Error('固定时区偏移须为 -12 至 +14 的整数');
  return value;
}

function offsetLabel(offset) {
  if (offset === 0) return 'UTC';
  return `UTC${offset > 0 ? '+' : ''}${offset}`;
}

function offsetSuffix(offset) {
  if (offset === 0) return 'Z';
  return `${offset > 0 ? '+' : '-'}${pad(Math.abs(offset))}:00`;
}

function exactSeconds(milliseconds) {
  const negative = milliseconds < 0n;
  const absolute = negative ? -milliseconds : milliseconds;
  const whole = absolute / 1000n;
  const fraction = absolute % 1000n;
  if (!fraction) return `${negative ? '-' : ''}${whole}`;
  return `${negative ? '-' : ''}${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
}

function ensureDateRange(milliseconds, offset) {
  if (milliseconds < -MAX_DATE_MS || milliseconds > MAX_DATE_MS) throw new Error('数值超出 JavaScript Date 支持范围');
  const shifted = milliseconds + BigInt(offset) * 3600000n;
  if (shifted < -MAX_DATE_MS || shifted > MAX_DATE_MS) throw new Error('数值在所选时区超出 Date 支持范围');
  return shifted;
}

function formatResult(milliseconds, offsetInput) {
  const offset = validateOffset(offsetInput);
  const shifted = ensureDateRange(milliseconds, offset);
  const localDate = new Date(Number(shifted));
  const utcDate = new Date(Number(milliseconds));
  const local = `${formatYear(localDate.getUTCFullYear())}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())} ${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}.${pad(localDate.getUTCMilliseconds(), 3)}`;
  const iso = `${local.replace(' ', 'T')}${offsetSuffix(offset)}`;
  const seconds = exactSeconds(milliseconds);
  const millisecondsText = milliseconds.toString();
  const utc = utcDate.toISOString();
  return { local, iso, utc, seconds, milliseconds: millisecondsText, offset, offsetLabel: offsetLabel(offset) };
}

function parseInteger(value) {
  const source = String(value == null ? '' : value).trim();
  if (!/^-?\d+$/.test(source)) throw new Error('时间戳必须是整数');
  try { return BigInt(source); } catch (error) { throw new Error('时间戳整数无效'); }
}

function convertTimestamp(value, unit = 'auto', offset = 8) {
  const source = String(value == null ? '' : value).trim();
  let milliseconds;
  if (unit === 'auto') {
    if (!/^(?:\d{10}|\d{13})$/.test(source)) throw new Error('自动识别仅支持 10 或 13 位非负时间戳');
    milliseconds = BigInt(source) * (source.length === 10 ? 1000n : 1n);
  } else if (unit === 'seconds') {
    milliseconds = parseInteger(source) * 1000n;
  } else if (unit === 'milliseconds') {
    milliseconds = parseInteger(source);
  } else {
    throw new Error('请选择有效的时间戳单位');
  }
  return formatResult(milliseconds, offset);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

function parseDateTime(value) {
  const source = String(value == null ? '' : value).trim();
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
  if (!match) throw new Error('日期格式须为 YYYY-MM-DD HH:mm:ss[.SSS]');
  const parts = match.slice(1, 7).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const millisecond = match[7] ? Number(match[7]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error('日期无效，请检查年月日');
  if (hour > 23 || minute > 59 || second > 59) throw new Error('时间无效，请检查时分秒');
  return { year, month, day, hour, minute, second, millisecond };
}

function convertDateTime(value, offsetInput = 8) {
  const offset = validateOffset(offsetInput);
  const valueParts = parseDateTime(value);
  const base = new Date(0);
  base.setUTCFullYear(valueParts.year, valueParts.month - 1, valueParts.day);
  base.setUTCHours(valueParts.hour, valueParts.minute, valueParts.second, valueParts.millisecond);
  const milliseconds = BigInt(base.getTime()) - BigInt(offset) * 3600000n;
  return formatResult(milliseconds, offset);
}

function convertBatch(text, options = {}) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  if (lines.length > MAX_ROWS) throw new Error(`每次最多转换 ${MAX_ROWS} 行`);
  const mode = options.mode === 'date' ? 'date' : 'timestamp';
  return lines.map((input, index) => {
    try {
      const value = mode === 'date' ? convertDateTime(input, options.offset) : convertTimestamp(input, options.unit, options.offset);
      return { index, input, ok: true, ...value };
    } catch (error) {
      return { index, input, ok: false, error: error.message || '转换失败' };
    }
  });
}

function formatRows(rows) {
  return rows.map(row => {
    if (!row.ok) return `第 ${row.index + 1} 行：${row.input || '（空行）'}\n错误：${row.error}`;
    return `第 ${row.index + 1} 行：${row.input}\n所选时区：${row.local}（${row.offsetLabel}，固定偏移）\nISO 8601：${row.iso}\nUTC：${row.utc}\n秒：${row.seconds}\n毫秒：${row.milliseconds}`;
  }).join('\n\n');
}

module.exports = {
  MAX_ROWS, MIN_OFFSET, MAX_OFFSET, validateOffset, offsetLabel,
  convertTimestamp, convertDateTime, convertBatch, formatRows
};
