const { parseDate, toDayNumber, formatDateParts, isLeapYear } = require('./local-date');

function birthdayInYear(birth, year) {
  const adjusted = birth.month === 2 && birth.day === 29 && !isLeapYear(year);
  return { date: formatDateParts({ year, month: birth.month, day: adjusted ? 28 : birth.day }), adjusted };
}

function calculateAge(birthDate, todayDate) {
  const birth = parseDate(birthDate);
  const today = parseDate(todayDate);
  const birthDay = toDayNumber(birth);
  const todayDay = toDayNumber(today);
  if (birthDay > todayDay) throw new Error('生日不能是未来日期');
  const thisBirthday = birthdayInYear(birth, today.year);
  let age = today.year - birth.year;
  if (todayDay < toDayNumber(thisBirthday.date)) age -= 1;
  let next = thisBirthday;
  if (todayDay > toDayNumber(thisBirthday.date)) next = birthdayInYear(birth, today.year + 1);
  return {
    age,
    livedDays: todayDay - birthDay,
    daysToBirthday: toDayNumber(next.date) - todayDay,
    nextBirthday: next.date,
    leapBirthdayAdjusted: next.adjusted
  };
}

module.exports = { calculateAge };
