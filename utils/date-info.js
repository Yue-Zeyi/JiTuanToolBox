const { parseDate, toDayNumber, weekdayIndex, isLeapYear } = require('./local-date');

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function isoWeekInfo(dayNumber) {
  const weekday = weekdayIndex(dayNumber);
  const isoWeekday = ((weekday + 6) % 7) + 1;
  const thursday = dayNumber + (4 - isoWeekday);
  const thursdayDate = require('./local-date').civilFromDays(thursday);
  const isoWeekYear = thursdayDate.year;
  const jan4 = toDayNumber(String(isoWeekYear).padStart(4, '0') + '-01-04');
  const jan4Weekday = ((weekdayIndex(jan4) + 6) % 7) + 1;
  const firstMonday = jan4 - (jan4Weekday - 1);
  return { isoWeekYear, isoWeek: Math.floor((dayNumber - firstMonday) / 7) + 1 };
}

function getDateInfo(date, todayDate) {
  const parts = parseDate(date);
  const dayNumber = toDayNumber(parts);
  const todayDay = toDayNumber(todayDate);
  const weekday = weekdayIndex(dayNumber);
  const jan1 = toDayNumber(String(parts.year).padStart(4, '0') + '-01-01');
  const iso = isoWeekInfo(dayNumber);
  return {
    weekday: WEEKDAYS[weekday],
    weekdayIndex: weekday,
    dayOfYear: dayNumber - jan1 + 1,
    isoWeek: iso.isoWeek,
    isoWeekYear: iso.isoWeekYear,
    quarter: Math.floor((parts.month - 1) / 3) + 1,
    leapYear: isLeapYear(parts.year),
    daysFromToday: dayNumber - todayDay
  };
}

module.exports = { getDateInfo };
