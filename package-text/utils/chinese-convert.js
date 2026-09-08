const cn2t = require('./vendor/opencc-cn2t');
const t2cn = require('./vendor/opencc-t2cn');

const MAX_TEXT_LENGTH = 20000;
const converters = {
  s2t: cn2t.Converter({ from: 'cn', to: 't' }),
  t2s: t2cn.Converter({ from: 't', to: 'cn' })
};

function convertChinese(text, mode = 's2t') {
  if (!converters[mode]) throw new Error('请选择有效的转换方向');
  const source = String(text == null ? '' : text);
  if (Array.from(source).length > MAX_TEXT_LENGTH) throw new Error(`最多输入 ${MAX_TEXT_LENGTH} 个字符`);
  return converters[mode](source);
}

module.exports = { MAX_TEXT_LENGTH, convertChinese };
