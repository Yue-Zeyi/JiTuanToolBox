const qrcode = require('./vendor/qrcode-generator');
const { analyzeAddress } = require('./ip-address');

const MAX_TEXT_LENGTH = 1000;
const ERROR_LEVELS = ['L', 'M', 'Q', 'H'];
const SIZES = [256, 512, 1024];
const QUIET_ZONE_MODULES = 4;

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function isHttpLink(link) {
  const match = /^https?:\/\/([^\s/?#\\]+)(?:[/?#][^\s\\]*)?$/i.exec(link);
  if (!match || match[1].includes('@')) return false;
  const authority = match[1];
  const parts = authority.startsWith('[')
    ? /^\[([^\]]+)\](?::(\d+))?$/.exec(authority)
    : /^([^:]+)(?::(\d+))?$/.exec(authority);
  if (!parts || (parts[2] !== undefined && Number(parts[2]) > 65535)) return false;
  const host = parts[1];
  if (authority.startsWith('[') || /^[\d.]+$/.test(host)) {
    try {
      return analyzeAddress(host).version === (authority.startsWith('[') ? 'IPv6' : 'IPv4');
    } catch (_) {
      return false;
    }
  }
  return host.length <= 253 && host.split('.').every(label =>
    label.length > 0 && label.length <= 63 &&
    /^[a-z\d\u00c0-\u024f\u3400-\u9fff](?:[a-z\d\u00c0-\u024f\u3400-\u9fff-]*[a-z\d\u00c0-\u024f\u3400-\u9fff])?$/i.test(label)
  );
}

function buildQrContent(text, mode = 'raw') {
  const source = String(text == null ? '' : text);
  if (!source.trim()) throw new Error('请输入要生成二维码的文字或网址');
  if (Array.from(source).length > MAX_TEXT_LENGTH) throw new Error(`最多输入 ${MAX_TEXT_LENGTH} 个字符`);
  if (mode === 'raw') return source;
  if (mode === 'text') return `文本内容：\n${source}`;
  if (mode !== 'link') throw new Error('请选择文字内容或链接模式');
  const link = source.trim();
  if (!isHttpLink(link)) throw new Error('请输入有效的 http:// 或 https:// 链接，检查域名、端口且不可包含空格');
  return link;
}

function createQrMatrix(text, level = 'M', mode = 'raw') {
  const source = buildQrContent(text, mode);
  if (!ERROR_LEVELS.includes(level)) throw new Error('请选择有效的二维码纠错级别');
  try {
    const qr = qrcode(0, level);
    qr.addData(source, 'Byte');
    qr.make();
    const moduleCount = qr.getModuleCount();
    const modules = Array.from({ length: moduleCount }, (_, row) =>
      Array.from({ length: moduleCount }, (_, column) => qr.isDark(row, column))
    );
    return { moduleCount, modules, level };
  } catch (error) {
    if (/code length overflow/i.test(String(error && error.message || error))) {
      throw new Error('内容超出所选纠错级别的二维码容量，请缩短内容或降低纠错级别');
    }
    throw error;
  }
}

function getQrLayout(matrix, size) {
  if (!matrix || !Number.isInteger(matrix.moduleCount) || matrix.moduleCount <= 0 || !Array.isArray(matrix.modules)) throw new Error('二维码矩阵无效');
  if (!SIZES.includes(Number(size))) throw new Error('请选择 256、512 或 1024 像素');
  const totalModules = matrix.moduleCount + QUIET_ZONE_MODULES * 2;
  const scale = Math.floor(Number(size) / totalModules);
  if (scale < 1) throw new Error('图片尺寸不足以绘制二维码');
  const contentSize = totalModules * scale;
  return { size: Number(size), scale, offset: Math.floor((Number(size) - contentSize) / 2), quietZone: QUIET_ZONE_MODULES };
}

function renderQrRgba(matrix, size) {
  const layout = getQrLayout(matrix, size);
  const pixels = new Uint8ClampedArray(layout.size * layout.size * 4);
  pixels.fill(255);
  const origin = layout.offset + layout.quietZone * layout.scale;
  matrix.modules.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
    if (!dark) return;
    const startX = origin + columnIndex * layout.scale;
    const startY = origin + rowIndex * layout.scale;
    for (let y = startY; y < startY + layout.scale; y += 1) {
      for (let x = startX; x < startX + layout.scale; x += 1) {
        const index = (y * layout.size + x) * 4;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      }
    }
  }));
  return pixels;
}

module.exports = { MAX_TEXT_LENGTH, ERROR_LEVELS, SIZES, QUIET_ZONE_MODULES, buildQrContent, createQrMatrix, getQrLayout, renderQrRgba };
