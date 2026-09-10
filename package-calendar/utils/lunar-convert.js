const { Solar, Lunar, LunarYear } = require('./vendor/lunar-javascript');

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function pad(value) { return String(value).padStart(2, '0'); }
function dateText(year, month, day) { return `${year}-${pad(month)}-${pad(day)}`; }

function assertYear(year) {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) throw new Error(`年份需在 ${MIN_YEAR} 至 ${MAX_YEAR} 之间`);
}

function resultFromSolar(solar) {
  const lunar = solar.getLunar();
  const festivals = [...lunar.getFestivals(), ...lunar.getOtherFestivals()].filter(Boolean);
  const month = lunar.getMonth();
  return {
    solarDate: dateText(solar.getYear(), solar.getMonth(), solar.getDay()),
    solarDisplay: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`,
    week: `星期${solar.getWeekInChinese()}`,
    lunarDate: `${lunar.getYearInChinese()}年${month < 0 ? '闰' : ''}${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    lunarYear: lunar.getYear(),
    lunarMonth: Math.abs(month),
    lunarDay: lunar.getDay(),
    isLeap: month < 0,
    zodiac: lunar.getYearShengXiao(),
    ganZhiYear: lunar.getYearInGanZhi(),
    ganZhiMonth: lunar.getMonthInGanZhiExact(),
    ganZhiDay: lunar.getDayInGanZhi(),
    jieQi: lunar.getJieQi() || '当日无节气交接',
    festivals: festivals.length ? festivals.join('、') : '当日无传统节日'
  };
}

function solarToLunar(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('请选择有效的公历日期');
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  assertYear(year);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) throw new Error('公历日期无效');
  return resultFromSolar(Solar.fromYmd(year, month, day));
}

function getLeapMonth(year) { assertYear(Number(year)); return LunarYear.fromYear(Number(year)).getLeapMonth() || 0; }

function lunarToSolar(yearValue, monthValue, dayValue, isLeap = false) {
  const year = Number(yearValue); const month = Number(monthValue); const day = Number(dayValue);
  assertYear(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('请选择有效的农历月份');
  const leapMonth = getLeapMonth(year);
  if (isLeap && leapMonth !== month) throw new Error(`${year} 年没有闰${month}月`);
  const lunarMonth = isLeap ? -month : month;
  const monthInfo = LunarYear.fromYear(year).getMonth(lunarMonth);
  if (!monthInfo) throw new Error('所选农历月份不存在');
  const maxDay = monthInfo.getDayCount();
  if (!Number.isInteger(day) || day < 1 || day > maxDay) throw new Error(`所选农历月份只有 ${maxDay} 天`);
  return resultFromSolar(Lunar.fromYmd(year, lunarMonth, day).getSolar());
}

module.exports = { MAX_YEAR, MIN_YEAR, getLeapMonth, lunarToSolar, solarToLunar };
