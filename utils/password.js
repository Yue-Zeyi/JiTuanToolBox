const MIN_LENGTH = 6;
const MAX_LENGTH = 128;
const MAX_COUNT = 100;
const CHARACTER_TYPES = [
  { key: 'uppercase', title: '大写字母', sample: 'A-Z', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { key: 'lowercase', title: '小写字母', sample: 'a-z', characters: 'abcdefghijklmnopqrstuvwxyz' },
  { key: 'digits', title: '数字', sample: '0-9', characters: '0123456789' },
  { key: 'symbols', title: '特殊符号', sample: '! @ # $ %', characters: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' }
];
const DEFAULT_SETTINGS = { length: 16, count: 1, types: CHARACTER_TYPES.map(type => type.key), include: '', exclude: '' };
const RANDOM_ERROR = '安全随机数获取失败，请更新微信后重试';

function prepareSettings(value) {
  const settings = { ...DEFAULT_SETTINGS, ...value };
  const length = Number(settings.length);
  const count = Number(settings.count);
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) throw new Error(`密码长度须为 ${MIN_LENGTH}-${MAX_LENGTH} 的整数`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw new Error(`生成数量须为 1-${MAX_COUNT} 的整数`);
  if (!Array.isArray(settings.types) || !settings.types.length || settings.types.some(key => !CHARACTER_TYPES.some(type => type.key === key))) throw new Error('请至少选择一种有效字符类型');
  const include = String(settings.include || '');
  const exclude = String(settings.exclude || '');
  if (/[^\x21-\x7E]/.test(include + exclude)) throw new Error('自定义字符仅支持半角字母、数字及符号，不含空格');
  const required = Array.from(new Set(include));
  const forbidden = new Set(exclude);
  if (required.some(character => forbidden.has(character))) throw new Error('必含字符与排除字符不能重复');
  const types = CHARACTER_TYPES.filter(type => settings.types.includes(type.key));
  const groups = types.map(type => {
    const characters = Array.from(type.characters).filter(character => !forbidden.has(character));
    if (!characters.length) throw new Error(`排除字符已移除全部${type.title}`);
    return characters;
  });
  const missingGroups = groups.filter(group => !required.some(character => group.includes(character)));
  if (required.length + missingGroups.length > length) throw new Error('当前长度不足以容纳必含字符与已选字符类型');
  const pool = Array.from(new Set(groups.reduce((all, group) => all.concat(group), required)));
  return { settings: { length, count, types: types.map(type => type.key), include, exclude }, required, missingGroups, pool };
}

function createWechatRandomSource(api) {
  return length => new Promise((resolve, reject) => {
    if (!api || typeof api.getRandomValues !== 'function') return reject(new Error(RANDOM_ERROR));
    api.getRandomValues({
      length,
      success(result) {
        const buffer = result && result.randomValues;
        if (Object.prototype.toString.call(buffer) !== '[object ArrayBuffer]' || buffer.byteLength !== length) return reject(new Error(RANDOM_ERROR));
        resolve(new Uint8Array(buffer));
      },
      fail: () => reject(new Error(RANDOM_ERROR))
    });
  });
}

async function randomIndex(size, nextByte) {
  const limit = 256 - (256 % size);
  let value;
  do { value = await nextByte(); } while (value >= limit);
  return value % size;
}

async function generatePasswords(value, readBytes) {
  const { settings, required, missingGroups, pool } = prepareSettings(value);
  if (typeof readBytes !== 'function') throw new Error(RANDOM_ERROR);
  let buffer = new Uint8Array(0);
  let offset = 0;
  const nextByte = async () => {
    if (offset >= buffer.length) {
      buffer = await readBytes(1024);
      offset = 0;
      if (!(buffer instanceof Uint8Array) || buffer.length !== 1024) throw new Error(RANDOM_ERROR);
    }
    return buffer[offset++];
  };
  const passwords = [];
  for (let index = 0; index < settings.count; index++) {
    const characters = required.slice();
    for (const group of missingGroups) characters.push(group[await randomIndex(group.length, nextByte)]);
    while (characters.length < settings.length) characters.push(pool[await randomIndex(pool.length, nextByte)]);
    // Shuffle mandatory characters too, so they never occupy fixed positions.
    for (let position = characters.length - 1; position > 0; position--) {
      const other = await randomIndex(position + 1, nextByte);
      [characters[position], characters[other]] = [characters[other], characters[position]];
    }
    passwords.push(characters.join(''));
  }
  return passwords;
}

module.exports = { MIN_LENGTH, MAX_LENGTH, MAX_COUNT, CHARACTER_TYPES, DEFAULT_SETTINGS, prepareSettings, createWechatRandomSource, randomIndex, generatePasswords };
