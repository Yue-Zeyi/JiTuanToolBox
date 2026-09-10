const MAX_INPUT = 100000;

function encodeUrl(value, scope = 'component') {
  const text = String(value);
  return scope === 'url' ? encodeURI(text) : encodeURIComponent(text);
}

function decodeUrl(value, scope = 'component', plusAsSpace = true) {
  const text = plusAsSpace ? String(value).replace(/\+/g, ' ') : String(value);
  try {
    return scope === 'url' ? decodeURI(text) : decodeURIComponent(text);
  } catch (_) {
    throw new Error('内容包含不完整的百分号编码，请检查后重试');
  }
}

module.exports = { MAX_INPUT, decodeUrl, encodeUrl };
