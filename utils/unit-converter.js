const Big = require('./vendor/big');
const Decimal = Big();
Decimal.DP = 120;
Decimal.RM = 1;
Decimal.NE = -9;
Decimal.PE = 18;

function unit(key, title, symbol, numerator, denominator = '1', offset = '0') {
  return { key, title, symbol, label: `${title} (${symbol})`, numerator, denominator, offset };
}

// Factors use SI definitions; US/Imperial volume, decimal/binary data and
// thermochemical calories are named explicitly to avoid ambiguous conversions.
const CATEGORIES = [
  { key: 'length', title: '长度', units: [
    unit('m', '米', 'm', '1'), unit('cm', '厘米', 'cm', '0.01'), unit('mm', '毫米', 'mm', '0.001'),
    unit('km', '千米', 'km', '1000'), unit('um', '微米', 'μm', '0.000001'), unit('nm', '纳米', 'nm', '0.000000001'),
    unit('in', '英寸', 'in', '0.0254'), unit('ft', '英尺', 'ft', '0.3048'), unit('yd', '码', 'yd', '0.9144'),
    unit('mi', '英里', 'mi', '1609.344'), unit('nmi', '海里', 'nmi', '1852')
  ] },
  { key: 'area', title: '面积', units: [
    unit('m2', '平方米', 'm²', '1'), unit('cm2', '平方厘米', 'cm²', '0.0001'), unit('km2', '平方千米', 'km²', '1000000'),
    unit('ha', '公顷', 'ha', '10000'), unit('mu', '市亩', '亩', '2000', '3'),
    unit('ft2', '平方英尺', 'ft²', '0.09290304'), unit('in2', '平方英寸', 'in²', '0.00064516'),
    unit('acre', '英亩', 'ac', '4046.8564224'), unit('mi2', '平方英里', 'mi²', '2589988.110336')
  ] },
  { key: 'volume', title: '体积', units: [
    unit('L', '升', 'L', '1'), unit('mL', '毫升', 'mL', '0.001'), unit('m3', '立方米', 'm³', '1000'),
    unit('cm3', '立方厘米', 'cm³', '0.001'), unit('ft3', '立方英尺', 'ft³', '28.316846592'),
    unit('in3', '立方英寸', 'in³', '0.016387064'), unit('us-gal', '美制液体加仑', 'US gal', '3.785411784'),
    unit('uk-gal', '英制加仑', 'Imp gal', '4.54609'), unit('us-fl-oz', '美制液体盎司', 'US fl oz', '0.0295735295625'),
    unit('uk-fl-oz', '英制液体盎司', 'Imp fl oz', '0.0284130625')
  ] },
  { key: 'mass', title: '质量', units: [
    unit('kg', '千克', 'kg', '1'), unit('g', '克', 'g', '0.001'), unit('mg', '毫克', 'mg', '0.000001'),
    unit('t', '公吨', 't', '1000'), unit('jin', '市斤', '斤', '0.5'), unit('lb', '常衡磅', 'lb', '0.45359237'),
    unit('oz', '常衡盎司', 'oz', '0.028349523125'), unit('short-ton', '美制短吨', 'short ton', '907.18474'),
    unit('long-ton', '英制长吨', 'long ton', '1016.046908')
  ] },
  { key: 'temperature', title: '温度', units: [
    unit('C', '摄氏度', '°C', '1', '1', '273.15'), unit('F', '华氏度', '°F', '5', '9', '459.67'),
    unit('K', '开尔文', 'K', '1')
  ] },
  { key: 'time', title: '时间', units: [
    unit('s', '秒', 's', '1'), unit('min', '分钟', 'min', '60'), unit('h', '小时', 'h', '3600'),
    unit('day', '天', 'd', '86400'), unit('week', '周', 'wk', '604800'),
    unit('ms', '毫秒', 'ms', '0.001'), unit('us', '微秒', 'μs', '0.000001'), unit('ns', '纳秒', 'ns', '0.000000001')
  ] },
  { key: 'speed', title: '速度', units: [
    unit('m/s', '米每秒', 'm/s', '1'), unit('km/h', '千米每小时', 'km/h', '5', '18'),
    unit('mph', '英里每小时', 'mph', '0.44704'), unit('ft/s', '英尺每秒', 'ft/s', '0.3048'),
    unit('kn', '节', 'kn', '1852', '3600')
  ] },
  { key: 'pressure', title: '压力', units: [
    unit('Pa', '帕斯卡', 'Pa', '1'), unit('kPa', '千帕', 'kPa', '1000'), unit('MPa', '兆帕', 'MPa', '1000000'),
    unit('bar', '巴', 'bar', '100000'), unit('mbar', '毫巴', 'mbar', '100'), unit('atm', '标准大气压', 'atm', '101325'),
    unit('psi', '磅力每平方英寸', 'psi', '4.4482216152605', '0.00064516'),
    unit('mmHg', '毫米汞柱（约定值）', 'mmHg', '133.322387415'), unit('Torr', '托', 'Torr', '101325', '760')
  ] },
  { key: 'data', title: '数据存储', units: [
    unit('B', '字节', 'B', '1'), unit('bit', '比特', 'bit', '1', '8'),
    unit('kB', '千字节（十进制）', 'kB', '1000'), unit('MB', '兆字节（十进制）', 'MB', '1000000'),
    unit('GB', '吉字节（十进制）', 'GB', '1000000000'), unit('TB', '太字节（十进制）', 'TB', '1000000000000'),
    unit('KiB', '千字节（二进制）', 'KiB', '1024'), unit('MiB', '兆字节（二进制）', 'MiB', '1048576'),
    unit('GiB', '吉字节（二进制）', 'GiB', '1073741824'), unit('TiB', '太字节（二进制）', 'TiB', '1099511627776')
  ] },
  { key: 'energy', title: '能量', units: [
    unit('J', '焦耳', 'J', '1'), unit('kJ', '千焦', 'kJ', '1000'), unit('MJ', '兆焦', 'MJ', '1000000'),
    unit('cal', '卡（热化学）', 'cal', '4.184'), unit('kcal', '千卡（热化学）', 'kcal', '4184'),
    unit('Wh', '瓦时', 'Wh', '3600'), unit('kWh', '千瓦时', 'kWh', '3600000'),
    unit('BTU', '英热单位（国际蒸汽表）', 'BTU IT', '1055.05585262'), unit('eV', '电子伏特', 'eV', '1.602176634e-19')
  ] },
  { key: 'power', title: '功率', units: [
    unit('W', '瓦', 'W', '1'), unit('kW', '千瓦', 'kW', '1000'), unit('MW', '兆瓦', 'MW', '1000000'),
    unit('mW', '毫瓦', 'mW', '0.001'), unit('hp', '英制机械马力', 'hp', '745.69987158227022'),
    unit('PS', '公制马力', 'PS', '735.49875')
  ] }
];

function getCategory(key) {
  const category = CATEGORIES.find(item => item.key === key);
  if (!category) throw new Error('请选择有效的换算类别');
  return category;
}

function parseValue(value) {
  const text = String(value).trim();
  if (!text || text.length > 80 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    throw new Error('请输入有效数字，可使用小数或科学计数法');
  }
  const result = new Decimal(text.replace(/^\+/, ''));
  if (result.e < -30 || result.e > 30) throw new Error('数值范围须在 1e-30 至 1e30 数量级内');
  return result;
}

function convert(value, categoryKey, fromKey, toKey) {
  const category = getCategory(categoryKey);
  const from = category.units.find(item => item.key === fromKey);
  const to = category.units.find(item => item.key === toKey);
  if (!from || !to) throw new Error('请选择当前类别中的单位');
  const input = parseValue(value);
  const baseNumerator = input.plus(from.offset).times(from.numerator);
  if (categoryKey === 'temperature' && baseNumerator.lt(0)) throw new Error('温度不能低于绝对零度');
  // Combine affine ratios before dividing so exact boundaries stay exact.
  const denominator = new Decimal(from.denominator).times(to.numerator);
  const numerator = baseNumerator.times(to.denominator).minus(new Decimal(to.offset).times(denominator));
  const rounded = numerator.div(denominator).prec(15);
  return {
    value: rounded.eq(0) ? '0' : rounded.toString(),
    approximate: !rounded.times(denominator).eq(numerator)
  };
}

function convertAll(value, categoryKey, fromKey) {
  return getCategory(categoryKey).units.map(item => ({
    key: item.key, title: item.title, symbol: item.symbol,
    ...convert(value, categoryKey, fromKey, item.key)
  }));
}

module.exports = { CATEGORIES, convert, convertAll };
