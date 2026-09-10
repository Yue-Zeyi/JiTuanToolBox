function utf8Bytes(character) {
  const code = character.codePointAt(0);
  if (code <= 0x7F) return [code];
  if (code <= 0x7FF) return [0xC0 | code >> 6, 0x80 | code & 0x3F];
  if (code <= 0xFFFF) return [0xE0 | code >> 12, 0x80 | code >> 6 & 0x3F, 0x80 | code & 0x3F];
  return [0xF0 | code >> 18, 0x80 | code >> 12 & 0x3F, 0x80 | code >> 6 & 0x3F, 0x80 | code & 0x3F];
}

function categoryOf(character, code) {
  if (/\s/.test(character)) return '空白字符';
  if (code >= 0x30 && code <= 0x39) return '数字';
  if (code >= 0x3400 && code <= 0x9FFF || code >= 0x20000 && code <= 0x3134F) return '汉字';
  if (code >= 0x41 && code <= 0x5A || code >= 0x61 && code <= 0x7A || code >= 0x00C0 && code <= 0x024F) return '拉丁字符';
  if (code >= 0x1F000 && code <= 0x1FAFF || code >= 0x2600 && code <= 0x27BF) return 'Emoji / 符号';
  if (code < 32 || code === 127) return '控制字符';
  if (/^[!-/:-@[-`{-~]$/.test(character) || code >= 0x3000 && code <= 0x303F || code >= 0xFF00 && code <= 0xFF65) return '标点符号';
  return '其他字符';
}

function analyzeUnicode(value) {
  const text = String(value || '');
  if (!text) throw new Error('请输入需要查询的字符');
  const characters = Array.from(text);
  if (characters.length > 50) throw new Error('每次最多查询 50 个 Unicode 字符');
  return characters.map((character, index) => {
    const code = character.codePointAt(0); const hex = code.toString(16).toUpperCase().padStart(4, '0');
    const units = []; for (let i = 0; i < character.length; i += 1) units.push(character.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'));
    const display = /[\s\u0000-\u001F\u007F]/u.test(character) ? ({ ' ': '空格', '\n': '换行', '\r': '回车', '\t': '制表符' }[character] || '控制字符') : character;
    return { index: index + 1, character, display, codePoint: `U+${hex}`, decimal: code, utf8: utf8Bytes(character).map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' '), utf16: units.map(unit => `0x${unit}`).join(' '), html: `&#x${hex};`, escape: code <= 0xFFFF ? `\\u${hex}` : `\\u{${hex}}`, category: categoryOf(character, code) };
  });
}

module.exports = { analyzeUnicode, utf8Bytes };
