const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_INPUT = 100000;

function utf8Encode(text) {
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xDC00 && low <= 0xDFFF) {
        code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
        index += 1;
      }
    }
    if (code <= 0x7F) bytes.push(code);
    else if (code <= 0x7FF) bytes.push(0xC0 | code >> 6, 0x80 | code & 0x3F);
    else if (code <= 0xFFFF) bytes.push(0xE0 | code >> 12, 0x80 | code >> 6 & 0x3F, 0x80 | code & 0x3F);
    else bytes.push(0xF0 | code >> 18, 0x80 | code >> 12 & 0x3F, 0x80 | code >> 6 & 0x3F, 0x80 | code & 0x3F);
  }
  return bytes;
}

function utf8Decode(bytes) {
  let output = '';
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index++];
    let code;
    if (first <= 0x7F) code = first;
    else if ((first & 0xE0) === 0xC0) {
      if (index >= bytes.length) throw new Error('Base64 中的 UTF-8 内容不完整');
      code = (first & 0x1F) << 6 | bytes[index++] & 0x3F;
      if (code < 0x80) throw new Error('Base64 不是有效的 UTF-8 文字');
    } else if ((first & 0xF0) === 0xE0) {
      if (index + 1 >= bytes.length) throw new Error('Base64 中的 UTF-8 内容不完整');
      code = (first & 0x0F) << 12 | (bytes[index++] & 0x3F) << 6 | bytes[index++] & 0x3F;
      if (code < 0x800 || code >= 0xD800 && code <= 0xDFFF) throw new Error('Base64 不是有效的 UTF-8 文字');
    } else if ((first & 0xF8) === 0xF0) {
      if (index + 2 >= bytes.length) throw new Error('Base64 中的 UTF-8 内容不完整');
      code = (first & 7) << 18 | (bytes[index++] & 0x3F) << 12 | (bytes[index++] & 0x3F) << 6 | bytes[index++] & 0x3F;
      if (code < 0x10000 || code > 0x10FFFF) throw new Error('Base64 不是有效的 UTF-8 文字');
    } else throw new Error('Base64 不是有效的 UTF-8 文字');
    if (code <= 0xFFFF) output += String.fromCharCode(code);
    else {
      code -= 0x10000;
      output += String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
    }
  }
  return output;
}

function encodeBase64(text) {
  const bytes = utf8Encode(String(text));
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    output += ALPHABET[a >> 2];
    output += ALPHABET[(a & 3) << 4 | b >> 4];
    output += index + 1 < bytes.length ? ALPHABET[(b & 15) << 2 | c >> 6] : '=';
    output += index + 2 < bytes.length ? ALPHABET[c & 63] : '=';
  }
  return output;
}

function decodeBase64(value) {
  const input = String(value).replace(/\s+/g, '');
  if (!input) return '';
  if (input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input) || /=/.test(input.slice(0, -2))) throw new Error('请输入完整且有效的 Base64 内容');
  const bytes = [];
  for (let index = 0; index < input.length; index += 4) {
    const a = ALPHABET.indexOf(input[index]);
    const b = ALPHABET.indexOf(input[index + 1]);
    const c = input[index + 2] === '=' ? 0 : ALPHABET.indexOf(input[index + 2]);
    const d = input[index + 3] === '=' ? 0 : ALPHABET.indexOf(input[index + 3]);
    bytes.push(a << 2 | b >> 4);
    if (input[index + 2] !== '=') bytes.push((b & 15) << 4 | c >> 2);
    if (input[index + 3] !== '=') bytes.push((c & 3) << 6 | d);
  }
  return utf8Decode(bytes);
}

module.exports = { MAX_INPUT, decodeBase64, encodeBase64, utf8Decode, utf8Encode };
