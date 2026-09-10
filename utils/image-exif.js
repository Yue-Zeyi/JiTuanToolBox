const STRIPPED_PNG_CHUNKS = ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'];
const STRIPPED_WEBP_CHUNKS = ['EXIF', 'XMP '];
const { outputName, normalizeFormat } = require('./image-output');

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => { output.set(part, offset); offset += part.length; });
  return output;
}

function ascii(bytes, start, length) {
  let value = '';
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(bytes[start + index]);
  return value;
}

function stripJpeg(bytes) {
  const parts = [bytes.slice(0, 2)];
  let position = 2;
  let removedCount = 0;
  while (position < bytes.length) {
    if (bytes[position] !== 0xFF || position + 1 >= bytes.length) { parts.push(bytes.slice(position)); break; }
    let markerOffset = position + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xFF) markerOffset += 1;
    const marker = bytes[markerOffset];
    if (marker === 0xDA || marker === 0xD9) { parts.push(bytes.slice(position)); break; }
    if (marker === 0x01 || marker >= 0xD0 && marker <= 0xD7) {
      parts.push(bytes.slice(position, markerOffset + 1));
      position = markerOffset + 1;
      continue;
    }
    if (markerOffset + 2 >= bytes.length) throw new Error('JPEG 文件结构不完整');
    const length = bytes[markerOffset + 1] << 8 | bytes[markerOffset + 2];
    const end = markerOffset + 1 + length;
    if (length < 2 || end > bytes.length) throw new Error('JPEG 元数据段损坏');
    if (marker === 0xE1 || marker === 0xED || marker === 0xFE) removedCount += 1;
    else parts.push(bytes.slice(position, end));
    position = end;
  }
  return { bytes: concatBytes(parts), format: 'jpg', removedCount };
}

function stripPng(bytes) {
  const parts = [bytes.slice(0, 8)];
  let position = 8;
  let removedCount = 0;
  while (position + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + position, 4);
    const length = view.getUint32(0, false);
    const end = position + 12 + length;
    if (end > bytes.length) throw new Error('PNG 文件结构不完整');
    const type = ascii(bytes, position + 4, 4);
    if (STRIPPED_PNG_CHUNKS.includes(type)) removedCount += 1;
    else parts.push(bytes.slice(position, end));
    position = end;
    if (type === 'IEND') break;
  }
  return { bytes: concatBytes(parts), format: 'png', removedCount };
}

function stripWebp(bytes) {
  const parts = [bytes.slice(0, 12)];
  let position = 12;
  let removedCount = 0;
  while (position + 8 <= bytes.length) {
    const type = ascii(bytes, position, 4);
    const view = new DataView(bytes.buffer, bytes.byteOffset + position + 4, 4);
    const length = view.getUint32(0, true);
    const end = position + 8 + length + (length % 2);
    if (end > bytes.length) throw new Error('WebP 文件结构不完整');
    if (STRIPPED_WEBP_CHUNKS.includes(type)) removedCount += 1;
    else if (type === 'VP8X' && length >= 1) {
      const chunk = bytes.slice(position, end);
      chunk[8] &= ~0x0C;
      parts.push(chunk);
    } else parts.push(bytes.slice(position, end));
    position = end;
  }
  const output = concatBytes(parts);
  new DataView(output.buffer, output.byteOffset + 4, 4).setUint32(0, output.length - 8, true);
  return { bytes: output, format: 'webp', removedCount };
}

function stripMetadata(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) return stripJpeg(bytes);
  if (bytes.length >= 8 && ascii(bytes, 1, 3) === 'PNG') return stripPng(bytes);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return stripWebp(bytes);
  throw new Error('去 EXIF 支持 JPG、JPEG、JFIF、PNG 和 WebP 图片');
}

function stripImageMetadata(filePath) {
  if (typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function' || !wx.env || !wx.env.USER_DATA_PATH) return Promise.reject(new Error('当前微信版本不支持本地元数据处理'));
  const fs = wx.getFileSystemManager();
  return new Promise((resolve, reject) => fs.readFile({
    filePath,
    success: result => {
      let stripped;
      try { stripped = stripMetadata(result.data); }
      catch (error) { reject(error); return; }
      const outputNameValue = outputName('jituan-image-exif', normalizeFormat(stripped.format));
      const outputPath = `${wx.env.USER_DATA_PATH}/${outputNameValue}`;
      const data = stripped.bytes.buffer.slice(stripped.bytes.byteOffset, stripped.bytes.byteOffset + stripped.bytes.byteLength);
      fs.writeFile({ filePath: outputPath, data, success: () => resolve({ outputPath, outputName: outputNameValue, outputFormat: stripped.format, bytes: stripped.bytes.length, removedCount: stripped.removedCount }), fail: () => reject(new Error('结果文件写入失败，请重试')) });
    },
    fail: () => reject(new Error('原图读取失败，请重新选择图片'))
  }));
}

module.exports = { stripImageMetadata, stripMetadata };
