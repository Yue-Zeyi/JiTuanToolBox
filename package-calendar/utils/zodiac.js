const { Solar, Lunar, LunarUtil } = require('./vendor/lunar-javascript');

const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const OFFSET = 8 * 60 * 60 * 1000;
const yearCache = {};
const pad = value => String(value).padStart(2, '0');

function currentParts(options = {}) {
  const input = options.now === undefined ? Date.now() : options.now;
  if (typeof input === 'string' && !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(input)) {
    throw new Error('当前时间必须包含时区');
  }
  const instant = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(instant)) throw new Error('当前时间无效');
  const shifted = new Date(instant + OFFSET);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const second = shifted.getUTCSeconds();
  return { instant, year, month, day, hour, minute, second, date: `${year}-${pad(month)}-${pad(day)}` };
}

function getToday(options) {
  return currentParts(options).date;
}

function parseYear(input) {
  if (!(typeof input === 'number' || typeof input === 'string' && /^\d{4}$/.test(input))) {
    throw new Error('请输入 1900 至 2100 年之间的整数年份');
  }
  const year = Number(input);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('年份范围为 1900 至 2100 年');
  return year;
}

function yearInfo(year) {
  if (!yearCache[year]) {
    const lunar = Lunar.fromYmd(year, 1, 1);
    const ganZhi = lunar.getYearInGanZhi();
    yearCache[year] = {
      year,
      yearLabel: `${year} ${ganZhi}年`,
      animal: lunar.getYearShengXiao(),
      ganZhi,
      stemElement: LunarUtil.WU_XING_GAN[lunar.getYearGan()],
      naYin: lunar.getYearNaYin(),
      cnyDate: lunar.getSolar().toYmd(),
      liChunAt: Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable()['立春'].toYmdHms()
    };
  }
  return { ...yearCache[year] };
}

function currentAnimals(current) {
  const lunar = Solar.fromYmdHms(current.year, current.month, current.day, current.hour, current.minute, current.second).getLunar();
  return { cny: lunar.getYearShengXiao(), lichun: lunar.getYearShengXiaoExact() };
}

function withBenMingNian(info, animal) {
  const isBenMingNian = info.animal === animal;
  return { ...info, isBenMingNian, benMingNianText: isBenMingNian ? '当前是本命年' : '当前不是本命年' };
}

function approximateYear(year, current, animals) {
  const info = yearInfo(year);
  const ageMax = year > current.year ? null : current.year - year;
  const ageMin = ageMax === null ? null : Math.max(0, ageMax - 1);
  return {
    ...withBenMingNian(info, animals.cny),
    ...(ageMax === null ? { isBenMingNian: null, benMingNianText: '尚未出生' } : {}),
    ageMin,
    ageMax,
    ageText: ageMax === null ? '尚未出生' : ageMin === ageMax ? `${ageMax}周岁` : `${ageMin}至${ageMax}周岁`,
    isApproximate: true,
    boundaryNote: '年份查询按该年春节后的农历年份概览；年初出生可能属上一年，周岁与本命年需结合生日和口径确认。'
  };
}

function getYearResult(input, options) {
  const year = parseYear(input);
  const current = currentParts(options);
  return approximateYear(year, current, currentAnimals(current));
}

function parseBirthday(dateString, timeString, current) {
  const match = typeof dateString === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) throw new Error('请输入有效的公历生日');
  const year = parseYear(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new Error('公历生日不存在');
  let time = null;
  if (timeString !== undefined && timeString !== null && timeString !== '') {
    time = typeof timeString === 'string' && /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeString);
    if (!time || Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3] || 0) > 59) throw new Error('出生时间格式为 HH:mm 或 HH:mm:ss');
  }
  const hour = time ? Number(time[1]) : 0;
  const minute = time ? Number(time[2]) : 0;
  const second = time ? Number(time[3] || 0) : 0;
  const start = Date.UTC(year, month - 1, day, hour, minute, second) - OFFSET;
  if (dateString > current.date || start > current.instant) throw new Error('出生日期或时间不能晚于当前时间');
  const precision = !time ? 'day' : time[3] === undefined ? 'minute' : 'second';
  const duration = precision === 'day' ? 86400000 : precision === 'minute' ? 60000 : 1000;
  return { year, month, day, start, end: start + duration, precision };
}

function ageAt(birth, current) {
  const leap = current.year % 4 === 0 && (current.year % 100 !== 0 || current.year % 400 === 0);
  const day = birth.month === 2 && birth.day === 29 && !leap ? 28 : birth.day;
  const beforeBirthday = current.month < birth.month || current.month === birth.month && current.day < day;
  return current.year - birth.year - (beforeBirthday ? 1 : 0);
}

function getBirthdayResult(dateString, timeString, options) {
  const current = currentParts(options);
  const birth = parseBirthday(dateString, timeString, current);
  const annual = yearInfo(birth.year);
  const animals = currentAnimals(current);
  const cnyYear = dateString < annual.cnyDate ? birth.year - 1 : birth.year;
  const cny = withBenMingNian(yearInfo(cnyYear), animals.cny);
  const liChunInstant = Date.parse(`${annual.liChunAt.replace(' ', 'T')}+08:00`);
  // A day or minute describes an interval; keep both outcomes when it spans LiChun.
  const isAmbiguous = birth.start < liChunInstant && birth.end > liChunInstant;
  const before = withBenMingNian(yearInfo(birth.year - 1), animals.lichun);
  const after = withBenMingNian(annual, animals.lichun);
  const lichun = isAmbiguous ? null : birth.start < liChunInstant ? before : after;
  const cnyAt = `${annual.cnyDate} 00:00:00`;
  const cnyFirst = cnyAt < annual.liChunAt;
  const differenceWindow = {
    startAt: cnyFirst ? cnyAt : annual.liChunAt,
    endAt: cnyFirst ? annual.liChunAt : cnyAt,
    earlierConvention: cnyFirst ? 'cny' : 'lichun'
  };
  const hasDifference = isAmbiguous ? null : cny.year !== lichun.year;
  const age = ageAt(birth, current);
  return {
    date: dateString,
    time: timeString || '',
    timePrecision: birth.precision,
    cny,
    lichun,
    lichunOptions: isAmbiguous ? [before, after] : [],
    cnyDate: annual.cnyDate,
    liChunAt: annual.liChunAt,
    differenceWindow,
    isAmbiguous,
    hasDifference,
    age,
    ageText: `${age}周岁`,
    boundaryNote: isAmbiguous
      ? '出生时间范围跨越立春，立春口径有两种可能；请补充交节前后的具体时间。'
      : hasDifference ? '生日位于春节与立春之间，两种口径的生肖不同。' : '该生日的春节与立春口径生肖一致。'
  };
}

function findZodiacYears(animal, startYear, endYear, options) {
  if (!ANIMALS.includes(animal)) throw new Error('请选择有效生肖');
  const start = parseYear(startYear);
  const end = parseYear(endYear);
  if (start > end) throw new Error('起始年份不能晚于结束年份');
  const current = currentParts(options);
  const animals = currentAnimals(current);
  const results = [];
  for (let year = start; year <= end; year += 1) {
    if (yearInfo(year).animal === animal) results.push(approximateYear(year, current, animals));
  }
  return results;
}

module.exports = { ANIMALS, getToday, getYearResult, getBirthdayResult, findZodiacYears };
