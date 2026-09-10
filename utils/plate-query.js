const PROVINCES = {
  京: '北京市', 津: '天津市', 沪: '上海市', 渝: '重庆市', 冀: '河北省', 豫: '河南省', 云: '云南省', 辽: '辽宁省', 黑: '黑龙江省', 湘: '湖南省',
  皖: '安徽省', 鲁: '山东省', 新: '新疆维吾尔自治区', 苏: '江苏省', 浙: '浙江省', 赣: '江西省', 鄂: '湖北省', 桂: '广西壮族自治区', 甘: '甘肃省', 晋: '山西省',
  蒙: '内蒙古自治区', 陕: '陕西省', 吉: '吉林省', 闽: '福建省', 贵: '贵州省', 粤: '广东省', 青: '青海省', 藏: '西藏自治区', 川: '四川省', 宁: '宁夏回族自治区', 琼: '海南省'
};
const PROVINCE_PATTERN = Object.keys(PROVINCES).join('');
const LETTER = '[A-HJ-NP-Z]';
const ALNUM = '[A-HJ-NP-Z0-9]';
const ordinary = new RegExp(`^[${PROVINCE_PATTERN}]${LETTER}${ALNUM}{5}$`);
const special = new RegExp(`^[${PROVINCE_PATTERN}]${LETTER}${ALNUM}{4}[挂学警港澳]$`);
const smallEnergy = new RegExp(`^[${PROVINCE_PATTERN}]${LETTER}[DF]${ALNUM}[0-9]{4}$`);
const largeEnergy = new RegExp(`^[${PROVINCE_PATTERN}]${LETTER}[0-9]{5}[DF]$`);

function normalizePlate(value) { return String(value || '').trim().toUpperCase().replace(/[\s·•-]+/g, ''); }

function invalidReason(plate) {
  if (!plate) return '请输入需要查询的车牌号';
  if (!PROVINCES[plate[0]]) return '首位应为有效的省级行政区简称';
  if (!new RegExp(`^${LETTER}$`).test(plate[1] || '')) return '第二位应为不含 I、O 的英文字母';
  if (plate.length !== 7 && plate.length !== 8) return '普通号牌应为 7 位，新能源号牌应为 8 位';
  return plate.length === 8 ? '新能源号牌的 D/F 位置或数字组合不符合规则' : '号牌序号仅支持数字、字母及规定的专用后缀';
}

function analyzePlate(value) {
  const plate = normalizePlate(value);
  let type = '';
  let typeLabel = '';
  let energy = '';
  let tone = 'blue';
  if (smallEnergy.test(plate)) {
    type = 'small-energy'; typeLabel = '小型新能源汽车号牌'; energy = plate[2] === 'D' ? '纯电动' : '非纯电动'; tone = 'green';
  } else if (largeEnergy.test(plate)) {
    type = 'large-energy'; typeLabel = '大型新能源汽车号牌'; energy = plate[7] === 'D' ? '纯电动' : '非纯电动'; tone = 'green';
  } else if (special.test(plate)) {
    const labels = { 警: '警用汽车号牌', 学: '教练汽车号牌', 挂: '挂车号牌', 港: '港澳入出境号牌（香港）', 澳: '港澳入出境号牌（澳门）' };
    type = 'special'; typeLabel = labels[plate.slice(-1)] || '专用汽车号牌'; tone = 'dark';
  } else if (ordinary.test(plate)) {
    type = 'ordinary'; typeLabel = '普通小型汽车号牌';
  } else {
    return { valid: false, plate, reason: invalidReason(plate) };
  }
  return {
    valid: true,
    plate,
    type,
    typeLabel,
    tone,
    prefix: plate.slice(0, 2),
    province: plate[0],
    provinceName: PROVINCES[plate[0]],
    agencyCode: plate[1],
    serial: plate.slice(2),
    energy,
    note: `“${plate[1]}”为发牌机关代码，具体城市或车辆信息需以当地车管部门数据为准。`
  };
}

module.exports = { PROVINCES, analyzePlate, normalizePlate };
