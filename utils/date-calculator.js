const { toDayNumber, formatDayNumber, weekdayIndex } = require('./local-date');

function dateDifference(start, end) {
  return toDayNumber(end) - toDayNumber(start);
}

function addCalendarDays(date, days) {
  if (!Number.isInteger(days)) throw new Error('天数必须是整数');
  return formatDayNumber(toDayNumber(date) + days);
}

function positiveBusinessDifference(startDay, endDay) {
  const span = endDay - startDay;
  if (span <= 0) return 0;
  let count = Math.floor(span / 7) * 5;
  const remainder = span % 7;
  const startWeekday = weekdayIndex(startDay);
  for (let offset = 1; offset <= remainder; offset += 1) {
    const weekday = (startWeekday + offset) % 7;
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
}

function businessDayDifference(start, end) {
  const startDay = toDayNumber(start);
  const endDay = toDayNumber(end);
  return endDay >= startDay
    ? positiveBusinessDifference(startDay, endDay)
    : -positiveBusinessDifference(endDay, startDay);
}

module.exports = { dateDifference, addCalendarDays, businessDayDifference };
