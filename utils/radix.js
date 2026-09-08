const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COMMON_BASES = [2, 8, 10, 16];
const WIDTHS = [8, 16, 32, 64, 128];
const MAX_INPUT_LENGTH = 5000;
const MAX_BATCH_LENGTH = 20000;
const MAX_BATCH_LINES = 100;
const MAX_FRACTION_DIGITS = 2048;
const MAX_DIVISION_STEPS = 200;
const MAX_DIVISION_TEXT_LENGTH = 64 * 1024;

function isBigIntSupported() {
  return typeof BigInt === 'function';
}

function requireBigInt() {
  if (!isBigIntSupported()) throw new Error('当前微信版本不支持精确大整数计算，请更新微信后重试');
}

function big(value) {
  requireBigInt();
  return BigInt(String(value));
}

const ZERO = () => big(0);
const ONE = () => big(1);

function normalizeBase(value, name) {
  const base = Number(value);
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error(`${name || '进制'}必须是 2 至 36 的整数`);
  return base;
}

function gcd(left, right) {
  let a = left < ZERO() ? -left : left;
  let b = right < ZERO() ? -right : right;
  while (b !== ZERO()) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || ONE();
}

function parseExact(input, sourceBase) {
  requireBigInt();
  const base = normalizeBase(sourceBase, '源进制');
  const raw = String(input === undefined || input === null ? '' : input);
  if (raw.length > MAX_INPUT_LENGTH) throw new Error(`单个输入最多 ${MAX_INPUT_LENGTH} 个字符`);
  const text = raw.trim();
  if (!text) throw new Error('请输入需要转换的数值');
  if (/[()]/.test(text)) throw new Error('暂不支持循环节输入，请输入有限小数');

  let sign = 1;
  let body = text;
  if (body[0] === '+' || body[0] === '-') {
    sign = body[0] === '-' ? -1 : 1;
    body = body.slice(1);
  }
  const pointCount = (body.match(/\./g) || []).length;
  if (pointCount > 1) throw new Error('一个数值只能包含一个小数点');
  const parts = body.split('.');
  const integerText = parts[0] || '';
  const fractionText = parts.length > 1 ? parts[1] : '';
  if (!integerText && !fractionText) throw new Error('数值中至少一个合法数位是必需的');

  const radix = big(base);
  let integer = ZERO();
  let fraction = ZERO();
  let denominator = ONE();
  let digitPosition = sign < 0 || text[0] === '+' ? 2 : 1;

  const readDigit = character => {
    const value = DIGITS.indexOf(character.toUpperCase());
    if (value < 0 || value >= base) throw new Error(`第 ${digitPosition} 个字符“${character}”不是 ${base} 进制合法数位`);
    digitPosition += 1;
    return big(value);
  };

  for (let index = 0; index < integerText.length; index += 1) integer = integer * radix + readDigit(integerText[index]);
  if (parts.length > 1) digitPosition += 1;
  for (let index = 0; index < fractionText.length; index += 1) {
    fraction = fraction * radix + readDigit(fractionText[index]);
    denominator *= radix;
  }

  let numerator = integer * denominator + fraction;
  if (sign < 0 && numerator !== ZERO()) numerator = -numerator;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor, sourceBase: base, input: text };
}

function integerToBase(value, targetBase) {
  const base = normalizeBase(targetBase, '目标进制');
  if (value === ZERO()) return '0';
  const radix = big(base);
  let current = value < ZERO() ? -value : value;
  const output = [];
  while (current > ZERO()) {
    output.push(DIGITS[Number(current % radix)]);
    current /= radix;
  }
  return output.reverse().join('');
}

function normalizePrecision(value) {
  const precision = value === undefined ? 256 : Number(value);
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_FRACTION_DIGITS) {
    throw new Error(`小数展开位数必须是 1 至 ${MAX_FRACTION_DIGITS} 的整数`);
  }
  return precision;
}

function formatExact(exact, targetBase, options) {
  requireBigInt();
  const base = normalizeBase(targetBase, '目标进制');
  const maxFractionDigits = normalizePrecision(options && options.maxFractionDigits);
  let numerator = exact.numerator;
  const denominator = exact.denominator;
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint' || denominator <= ZERO()) throw new Error('无效的精确有理数');

  const negative = numerator < ZERO();
  if (negative) numerator = -numerator;
  const integer = numerator / denominator;
  let remainder = numerator % denominator;
  const integerPart = integerToBase(integer, base);
  const fractionDigits = [];
  const seen = new Map();
  let cycleStart = -1;
  const radix = big(base);

  while (remainder !== ZERO() && fractionDigits.length < maxFractionDigits) {
    if (seen.has(remainder)) {
      cycleStart = seen.get(remainder);
      break;
    }
    seen.set(remainder, fractionDigits.length);
    remainder *= radix;
    fractionDigits.push(DIGITS[Number(remainder / denominator)]);
    remainder %= denominator;
  }
  if (remainder !== ZERO() && cycleStart < 0 && seen.has(remainder)) cycleStart = seen.get(remainder);

  const repeating = cycleStart >= 0;
  const truncated = remainder !== ZERO() && !repeating;
  let fractionPart = fractionDigits.join('');
  if (repeating) fractionPart = `${fractionDigits.slice(0, cycleStart).join('')}(${fractionDigits.slice(cycleStart).join('')})`;
  if (truncated) fractionPart += '…';
  const sign = negative && (integer !== ZERO() || fractionDigits.length) ? '-' : '';
  const value = `${sign}${integerPart}${fractionPart ? `.${fractionPart}` : ''}`;
  const status = repeating ? 'repeating' : truncated ? 'truncated' : fractionDigits.length ? 'terminating' : 'integer';
  const note = repeating
    ? `循环节从小数第 ${cycleStart + 1} 位开始，共 ${fractionDigits.length - cycleStart} 位`
    : truncated
      ? `已展开 ${maxFractionDigits} 位，尚未终止或发现循环，结果已截断且未精确表示`
      : '结果为精确值';
  return {
    targetBase: base,
    value,
    integerPart: `${sign}${integerPart}`,
    fractionPart,
    status,
    exact: !truncated,
    repeating,
    truncated,
    cycleStart: repeating ? cycleStart : null,
    cycleLength: repeating ? fractionDigits.length - cycleStart : 0,
    digitsGenerated: fractionDigits.length,
    note
  };
}

function convert(input, sourceBase, targetBase, options) {
  const parsed = parseExact(input, sourceBase);
  return { input: parsed.input, sourceBase: parsed.sourceBase, ...formatExact(parsed, targetBase, options) };
}

function convertCommon(input, sourceBase, options) {
  const parsed = parseExact(input, sourceBase);
  return COMMON_BASES.map(base => ({ base, label: `${base} 进制`, input: parsed.input, sourceBase: parsed.sourceBase, ...formatExact(parsed, base, options) }));
}

function twosComplement(input, sourceBase, widthValue) {
  const width = Number(widthValue);
  if (!WIDTHS.includes(width)) throw new Error('补码位宽仅支持 8、16、32、64 或 128 位');
  const parsed = parseExact(input, sourceBase);
  if (parsed.denominator !== ONE()) throw new Error('补码视图仅支持整数');
  const value = parsed.numerator;
  const modulus = ONE() << big(width);
  const half = ONE() << big(width - 1);
  const minimum = -half;
  const maximum = half - ONE();
  if (value < minimum || value > maximum) throw new Error(`${width} 位有符号整数范围为 ${minimum.toString()} 至 ${maximum.toString()}`);
  const pattern = value < ZERO() ? modulus + value : value;
  const binary = integerToBase(pattern, 2).padStart(width, '0');
  const hex = integerToBase(pattern, 16).padStart(width / 4, '0');
  const bytes = [];
  for (let index = 0; index < hex.length; index += 2) bytes.push(hex.slice(index, index + 2));
  return {
    width,
    signedDecimal: value.toString(),
    binary,
    hex,
    bigEndian: bytes.join(' '),
    littleEndian: bytes.slice().reverse().join(' ')
  };
}

function divisionSteps(input, sourceBase, targetBase, limitValue) {
  const base = normalizeBase(targetBase, '目标进制');
  const settings = limitValue && typeof limitValue === 'object' ? limitValue : { maxSteps: limitValue };
  const configuredLimit = settings.maxSteps === undefined ? MAX_DIVISION_STEPS : Number(settings.maxSteps);
  const limit = Math.min(MAX_DIVISION_STEPS, Math.max(1, Number.isInteger(configuredLimit) ? configuredLimit : MAX_DIVISION_STEPS));
  const configuredTextLength = settings.maxTextLength === undefined ? Infinity : Number(settings.maxTextLength);
  const maxTextLength = Number.isInteger(configuredTextLength) && configuredTextLength > 0 ? configuredTextLength : Infinity;
  const parsed = parseExact(input, sourceBase);
  let current = parsed.numerator < ZERO() ? -parsed.numerator : parsed.numerator;
  current /= parsed.denominator;
  const divisor = big(base);
  const steps = [];
  let serializedLength = 2;
  let stopReason = null;
  if (current === ZERO()) {
    steps.push({ index: 1, dividend: '0', divisor: String(base), quotient: '0', remainder: '0', digit: '0' });
  } else {
    while (current > ZERO() && steps.length < limit) {
      const quotient = current / divisor;
      const remainder = current % divisor;
      const step = {
        index: steps.length + 1,
        dividend: current.toString(),
        divisor: String(base),
        quotient: quotient.toString(),
        remainder: remainder.toString(),
        digit: DIGITS[Number(remainder)]
      };
      const stepLength = JSON.stringify(step).length + (steps.length ? 1 : 0);
      if (serializedLength + stepLength > maxTextLength) {
        stopReason = 'text-budget';
        break;
      }
      steps.push(step);
      serializedLength += stepLength;
      current = quotient;
    }
  }
  const complete = current === ZERO();
  if (!complete && !stopReason) stopReason = 'step-limit';
  const partialNote = stopReason === 'text-budget'
    ? `仅展示前 ${steps.length} 步，步骤文本达到 ${maxTextLength} 字符上限，后续步骤未全部展示；负号另行处理，小数部分不在这些步骤中`
    : `仅展示前 ${steps.length} 步，后续步骤未全部展示；负号另行处理，小数部分不在这些步骤中`;
  return {
    steps,
    complete,
    truncated: !complete,
    displayedSteps: steps.length,
    stopReason,
    note: complete ? '余数自下而上排列；负号另行处理，小数部分不在这些步骤中' : partialNote
  };
}

function prepareBatch(input, sourceBase, targetBase) {
  requireBigInt();
  normalizeBase(sourceBase, '源进制');
  normalizeBase(targetBase, '目标进制');
  const text = String(input === undefined || input === null ? '' : input).replace(/\r\n?/g, '\n');
  if (text.length > MAX_BATCH_LENGTH) throw new Error(`批量输入总长度最多 ${MAX_BATCH_LENGTH} 个字符`);
  const lines = text.split('\n');
  if (lines.length > MAX_BATCH_LINES) throw new Error(`批量转换最多 ${MAX_BATCH_LINES} 行`);
  return lines;
}

function convertBatchLine(line, index, sourceBase, targetBase, options) {
  try {
    const result = convert(line, sourceBase, targetBase, options);
    return { line: index + 1, input: line, ok: true, output: result.value, status: result.status, exact: result.exact, note: result.note };
  } catch (error) {
    return { line: index + 1, input: line, ok: false, error: error.message || '转换失败' };
  }
}

function summarizeBatch(rows) {
  const successCount = rows.filter(row => row.ok).length;
  const errorCount = rows.length - successCount;
  return {
    rows,
    successCount,
    errorCount,
    text: rows.map(row => `${row.line}. ${row.input} → ${row.ok ? row.output : `错误：${row.error}`}`).join('\n')
  };
}

function convertBatch(input, sourceBase, targetBase, options) {
  const lines = prepareBatch(input, sourceBase, targetBase);
  return summarizeBatch(lines.map((line, index) => convertBatchLine(line, index, sourceBase, targetBase, options)));
}

async function convertBatchAsync(input, sourceBase, targetBase, options, yieldControl) {
  const lines = prepareBatch(input, sourceBase, targetBase);
  const configuredChunkSize = options && Number(options.chunkSize);
  const chunkSize = Number.isInteger(configuredChunkSize) && configuredChunkSize > 0 ? Math.min(configuredChunkSize, 25) : 10;
  const pause = typeof yieldControl === 'function' ? yieldControl : () => new Promise(resolve => setTimeout(resolve, 0));
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    rows.push(convertBatchLine(lines[index], index, sourceBase, targetBase, options));
    if ((index + 1) % chunkSize === 0 && index + 1 < lines.length) await pause();
  }
  return summarizeBatch(rows);
}

module.exports = {
  DIGITS,
  COMMON_BASES,
  WIDTHS,
  MAX_INPUT_LENGTH,
  MAX_BATCH_LENGTH,
  MAX_BATCH_LINES,
  MAX_FRACTION_DIGITS,
  MAX_DIVISION_STEPS,
  MAX_DIVISION_TEXT_LENGTH,
  isBigIntSupported,
  parseExact,
  formatExact,
  convert,
  convertCommon,
  twosComplement,
  divisionSteps,
  convertBatch,
  convertBatchAsync
};
