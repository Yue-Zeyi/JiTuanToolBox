const { daysInMonth } = require('./local-date');

const SIGNS = [
  { key: 'capricorn', name: '摩羯座', range: '12月22日—1月19日', element: '土象' },
  { key: 'aquarius', name: '水瓶座', range: '1月20日—2月18日', element: '风象', start: 120 },
  { key: 'pisces', name: '双鱼座', range: '2月19日—3月20日', element: '水象', start: 219 },
  { key: 'aries', name: '白羊座', range: '3月21日—4月19日', element: '火象', start: 321 },
  { key: 'taurus', name: '金牛座', range: '4月20日—5月20日', element: '土象', start: 420 },
  { key: 'gemini', name: '双子座', range: '5月21日—6月21日', element: '风象', start: 521 },
  { key: 'cancer', name: '巨蟹座', range: '6月22日—7月22日', element: '水象', start: 622 },
  { key: 'leo', name: '狮子座', range: '7月23日—8月22日', element: '火象', start: 723 },
  { key: 'virgo', name: '处女座', range: '8月23日—9月22日', element: '土象', start: 823 },
  { key: 'libra', name: '天秤座', range: '9月23日—10月23日', element: '风象', start: 923 },
  { key: 'scorpio', name: '天蝎座', range: '10月24日—11月22日', element: '水象', start: 1024 },
  { key: 'sagittarius', name: '射手座', range: '11月23日—12月21日', element: '火象', start: 1123 }
];

function getConstellation(monthValue, dayValue) {
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('月份无效');
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(2000, month)) throw new Error('日期无效');
  const score = month * 100 + day;
  let sign = SIGNS[0];
  for (let index = 1; index < SIGNS.length; index += 1) {
    if (score >= SIGNS[index].start) sign = SIGNS[index];
  }
  if (score >= 1222) sign = SIGNS[0];
  return { key: sign.key, name: sign.name, range: sign.range, element: sign.element };
}

module.exports = { getConstellation };
