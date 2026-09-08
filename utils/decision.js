const { createWechatRandomSource, randomIndex } = require('./password');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;
const MAX_OPTION_LENGTH = 30;
const MAX_INPUT_LENGTH = 1000;
const MODES = ['wheel', 'grid', 'draw', 'roll', 'flip'];

function prepareOptions(input) {
  const source = typeof input === 'string' ? input : '';
  if (source.length > MAX_INPUT_LENGTH) throw new Error(`总输入不能超过 ${MAX_INPUT_LENGTH} 个字符`);
  const rows = source.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (rows.some(value => Array.from(value).length > MAX_OPTION_LENGTH)) throw new Error(`每个选项不能超过 ${MAX_OPTION_LENGTH} 个字符`);
  const options = Array.from(new Set(rows));
  if (options.length < MIN_OPTIONS) throw new Error(`请至少输入 ${MIN_OPTIONS} 个不同选项`);
  if (options.length > MAX_OPTIONS) throw new Error(`最多输入 ${MAX_OPTIONS} 个不同选项`);
  return { options, duplicateCount: rows.length - options.length };
}

async function chooseDecision(options, readBytes) {
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) throw new Error('选项数量无效');
  if (typeof readBytes !== 'function') throw new Error('安全随机数获取失败，请更新微信后重试');
  const nextByte = async () => {
    const bytes = await readBytes(1);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 1) throw new Error('安全随机数获取失败，请更新微信后重试');
    return bytes[0];
  };
  const index = await randomIndex(options.length, nextByte);
  return { index, value: options[index] };
}

function getWheelIndex(rotation, count) {
  if (!Number.isInteger(count) || count < MIN_OPTIONS || count > MAX_OPTIONS || !Number.isFinite(rotation)) throw new Error('转盘参数无效');
  const step = 360 / count;
  const normalized = ((-rotation % 360) + 360) % 360;
  return Math.round(normalized / step) % count;
}

function getVisualTarget(mode, index, count) {
  if (!MODES.includes(mode) || !Number.isInteger(count) || count < MIN_OPTIONS || count > MAX_OPTIONS || !Number.isInteger(index) || index < 0 || index >= count) throw new Error('动画目标无效');
  if (mode === 'wheel') return { index, rotation: 5 * 360 - index * (360 / count) };
  return { index };
}

module.exports = {
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_OPTION_LENGTH,
  MAX_INPUT_LENGTH,
  MODES,
  prepareOptions,
  chooseDecision,
  getVisualTarget,
  getWheelIndex,
  createWechatRandomSource
};
