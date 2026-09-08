const DAYS_PER_ERA = 146097;

function isLeapYear(year) {
  return Number.isInteger(year) && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('日期范围无效');
  }
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) throw new Error('日期格式应为 YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) throw new Error('日期范围无效');
  if (day < 1 || day > daysInMonth(year, month)) throw new Error('日期不存在');
  return { year, month, day };
}

function daysFromCivil(year, month, day) {
  let y = year;
  y -= month <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = month + (month > 2 ? -3 : 9);
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * DAYS_PER_ERA + doe - 719468;
}

function civilFromDays(dayNumber) {
  let z = dayNumber + 719468;
  const era = Math.floor(z / DAYS_PER_ERA);
  const doe = z - era * DAYS_PER_ERA;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

function toDayNumber(value) {
  const { year, month, day } = typeof value === 'string' ? parseDate(value) : value;
  return daysFromCivil(year, month, day);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateParts(parts) {
  if (!parts || parts.year < 1 || parts.year > 9999) throw new Error('日期超出支持范围');
  return String(parts.year).padStart(4, '0') + '-' + pad(parts.month) + '-' + pad(parts.day);
}

function formatDayNumber(dayNumber) {
  if (!Number.isInteger(dayNumber)) throw new Error('日期序号无效');
  return formatDateParts(civilFromDays(dayNumber));
}

function addDays(value, amount) {
  if (!Number.isInteger(amount)) throw new Error('天数必须是整数');
  return formatDayNumber(toDayNumber(value) + amount);
}

function weekdayIndex(value) {
  const dayNumber = typeof value === 'number' ? value : toDayNumber(value);
  return ((dayNumber + 4) % 7 + 7) % 7;
}

function compareDates(left, right) {
  return toDayNumber(left) - toDayNumber(right);
}

function localToday(date = new Date()) {
  return formatDateParts({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
}

module.exports = {
  isLeapYear,
  daysInMonth,
  parseDate,
  toDayNumber,
  civilFromDays,
  formatDateParts,
  formatDayNumber,
  addDays,
  weekdayIndex,
  compareDates,
  localToday
};
