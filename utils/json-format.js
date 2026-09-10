const MAX_INPUT = 100000;
const MAX_DEPTH = 128;
const MAX_OUTPUT = 500000;

// Keep tokens instead of JS numbers/objects: precision, duplicate keys and order survive.
function parseJson(source, options = {}) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('请先输入 JSON 内容');
  if (source.length > MAX_INPUT) throw new Error('内容超过 100000 字符，请缩减后重试');
  let pos = 0, nodeCount = 0, duplicates = 0, comments = 0;
  function fail(message, index = pos) {
    const lines = source.slice(0, index).split(/\r\n|\r|\n/);
    const error = new Error(message);
    Object.assign(error, { index, line: lines.length, column: lines[lines.length - 1].length + 1 });
    throw error;
  }
  function space() {
    while (pos < source.length) {
      if (/[ \t\r\n]/.test(source[pos])) { pos++; continue; }
      if (source[pos] !== '/' || !['/', '*'].includes(source[pos + 1])) return;
      if (!options.allowComments) fail('检测到注释，请开启“允许注释”或移除注释');
      const start = pos, lineComment = source[pos + 1] === '/';
      pos += 2;
      if (lineComment) {
        while (pos < source.length && source[pos] !== '\r' && source[pos] !== '\n') pos++;
      } else {
        while (pos < source.length && !(source[pos] === '*' && source[pos + 1] === '/')) pos++;
        if (pos >= source.length) fail('块注释缺少结束符 */', start);
        pos += 2;
      }
      comments++;
    }
  }
  function string() {
    const start = pos++;
    while (pos < source.length) {
      const char = source[pos++];
      if (char === '"') return source.slice(start, pos);
      if (char.charCodeAt(0) < 32) fail('字符串中不能直接包含换行或控制字符', pos - 1);
      if (char === '\\') {
        const escape = source[pos++];
        if (escape === 'u') {
          for (let i = 0; i < 4; i++) {
            if (pos >= source.length || !/[0-9a-fA-F]/.test(source[pos])) fail('Unicode 转义需要 4 位十六进制数字');
            pos++;
          }
        } else if (!escape || !'"\\/bfnrt'.includes(escape)) fail('无效的字符串转义', pos - 1);
      }
    }
    fail('字符串缺少结束双引号', source.length);
  }
  function value(depth) {
    space();
    if (depth > MAX_DEPTH) fail('嵌套超过 128 层，请简化结构');
    const node = { id: nodeCount++ };
    const char = source[pos];
    if (char === '{' || char === '[') {
      const object = char === '{', close = object ? '}' : ']';
      node.type = object ? 'object' : 'array';
      node.children = [];
      const keys = new Set();
      pos++; space();
      if (source[pos] === close) { pos++; return node; }
      while (true) {
        let key;
        if (object) {
          if (source[pos] !== '"') fail('对象的键名必须使用双引号');
          key = string();
          const decoded = JSON.parse(key);
          if (keys.has(decoded)) duplicates++;
          keys.add(decoded);
          space();
          if (source[pos] !== ':') fail('键名后缺少冒号 :');
          pos++;
        }
        const child = value(depth + 1);
        if (object) child.key = key;
        node.children.push(child);
        space();
        if (source[pos] === close) { pos++; return node; }
        if (source[pos] !== ',') fail('此处需要逗号或结束符 ' + close);
        pos++; space();
        if (source[pos] === close) fail('最后一项后不能有多余逗号');
      }
    }
    if (char === '"') { node.type = 'string'; node.raw = string(); return node; }
    for (const literal of ['true', 'false', 'null']) {
      if (source.slice(pos, pos + literal.length) === literal) {
        pos += literal.length;
        return { ...node, type: literal === 'null' ? 'null' : 'boolean', raw: literal };
      }
    }
    if (char === '-' || (char && /[0-9]/.test(char))) {
      const start = pos;
      while (pos < source.length && /[0-9eE+.\-]/.test(source[pos])) pos++;
      const raw = source.slice(start, pos);
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) fail('数字格式有误，不能有前导零或缺失的小数、指数', start);
      return { ...node, type: 'number', raw };
    }
    fail(pos >= source.length ? '内容不完整，此处需要一个 JSON 值' : '此处不是有效的 JSON 值（键名和字符串须使用双引号）');
  }
  const root = value(0);
  space();
  if (pos !== source.length) fail('JSON 值后存在多余内容');
  return { root, nodeCount, duplicates, comments };
}

function formatJson(root, indent = 2) {
  if (![0, 2, 4].includes(indent)) throw new Error('请选择 2 空格、4 空格或压缩');
  const parts = [];
  let length = 0;
  function add(text) {
    length += text.length;
    if (length > MAX_OUTPUT) throw new Error('展开后超过 50 万字符，请选择压缩或缩减内容');
    parts.push(text);
  }
  function write(node, depth) {
    if (!node.children) return add(node.raw);
    const object = node.type === 'object';
    add(object ? '{' : '[');
    node.children.forEach((child, index) => {
      if (index) add(',');
      if (indent) add('\n' + ' '.repeat((depth + 1) * indent));
      if (object) add(child.key + (indent ? ': ' : ':'));
      write(child, depth + 1);
    });
    if (indent && node.children.length) add('\n' + ' '.repeat(depth * indent));
    add(object ? '}' : ']');
  }
  write(root, 0);
  return parts.join('');
}

function getTreeRows(root, expanded, limit = 200, offset = 0) {
  const rows = [], stack = [{ node: root, depth: 0, label: '根节点' }];
  let visited = 0;
  while (stack.length && rows.length < limit) {
    const { node, depth, label } = stack.pop();
    const branch = Boolean(node.children && node.children.length);
    const open = branch && expanded.has(node.id);
    const preview = node.children ? (node.type === 'object' ? '{ }' : '[ ]') + ' · ' + node.children.length + ' 项' : node.raw;
    if (visited++ >= offset) rows.push({ id: node.id, label: label.length > 80 ? label.slice(0, 80) + '…' : label, preview: preview.length > 160 ? preview.slice(0, 160) + '…' : preview, type: node.type, branch, open, padding: Math.min(depth, 8) * 20, deep: depth > 8 ? depth : 0 });
    if (open) for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      stack.push({ node: child, depth: depth + 1, label: node.type === 'object' ? child.key : '[' + i + ']' });
    }
  }
  return { rows, more: stack.length > 0 };
}

module.exports = { parseJson, formatJson, getTreeRows, MAX_INPUT };
