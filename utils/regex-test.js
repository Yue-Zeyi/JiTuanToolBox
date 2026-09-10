const MAX_PATTERN = 2000;
const MAX_TEXT = 100000;
const MAX_MATCHES = 500;

function normalizeFlags(flags) {
  const order = ['g', 'i', 'm', 's', 'u'];
  const source = Array.isArray(flags) ? flags.join('') : String(flags || '');
  return order.filter(flag => source.includes(flag)).join('');
}

function runRegex(pattern, flags, text) {
  if (!String(pattern)) throw new Error('请先输入正则表达式');
  const source = String(text || '');
  const normalized = normalizeFlags(flags);
  let expression;
  try { expression = new RegExp(String(pattern), normalized); }
  catch (error) { throw new Error(`表达式有误：${String(error.message || '').replace(/^Invalid regular expression:\s*/i, '')}`); }
  const matches = [];
  let match;
  if (normalized.includes('g')) {
    while ((match = expression.exec(source)) && matches.length < MAX_MATCHES) {
      matches.push({ index: match.index, end: match.index + match[0].length, value: match[0], groups: match.slice(1).map((value, index) => ({ index: index + 1, value: value === undefined ? '未匹配' : value })) });
      if (match[0] === '') expression.lastIndex += normalized.includes('u') && source.codePointAt(expression.lastIndex) > 0xFFFF ? 2 : 1;
    }
  } else {
    match = expression.exec(source);
    if (match) matches.push({ index: match.index, end: match.index + match[0].length, value: match[0], groups: match.slice(1).map((value, index) => ({ index: index + 1, value: value === undefined ? '未匹配' : value })) });
  }
  const segments = [];
  let cursor = 0;
  matches.forEach(item => {
    if (item.index > cursor) segments.push({ type: 'plain', text: source.slice(cursor, item.index) });
    if (item.end > item.index) {
      segments.push({ type: 'match', text: source.slice(item.index, item.end) });
      cursor = Math.max(cursor, item.end);
    }
  });
  if (cursor < source.length) segments.push({ type: 'plain', text: source.slice(cursor) });
  return { flags: normalized, matches, segments, truncated: matches.length >= MAX_MATCHES && normalized.includes('g') };
}

module.exports = { MAX_MATCHES, MAX_PATTERN, MAX_TEXT, normalizeFlags, runRegex };
