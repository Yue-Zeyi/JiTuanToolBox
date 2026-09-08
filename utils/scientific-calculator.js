const FUNCTIONS = new Set(['sqrt', 'sin', 'cos', 'tan', 'ln', 'log']);

function tokenize(source) {
  const input = String(source || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
  if (!input) throw new Error('请输入表达式');
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { index += whitespace[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error('数字超出可计算范围');
      tokens.push({ type: 'number', value });
      index += number[0].length;
      continue;
    }
    const identifier = /^(?:[A-Za-z]+|π)/.exec(rest);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() === 'π' ? 'pi' : identifier[0].toLowerCase() });
      index += identifier[0].length;
      continue;
    }
    const char = input[index];
    if ('+-*/^%()'.includes(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }
    throw new Error('表达式包含不支持的字符');
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

function ensureFinite(value) {
  if (Number.isNaN(value)) throw new Error('结果无定义');
  if (!Number.isFinite(value)) throw new Error('结果超出可计算范围');
  return value;
}

function evaluateExpression(expression, angleMode = 'DEG') {
  const mode = String(angleMode || 'DEG').toUpperCase();
  if (!['DEG', 'RAD'].includes(mode)) throw new Error('角度模式必须是 DEG 或 RAD');
  const tokens = tokenize(expression);
  let index = 0;
  const current = () => tokens[index];
  const consume = type => {
    if (current().type !== type) throw new Error('表达式格式不正确');
    return tokens[index++];
  };

  function parseExpression() {
    let value = parseTerm();
    while (current().type === '+' || current().type === '-') {
      const operator = current().type;
      index += 1;
      const right = parseTerm();
      value = ensureFinite(operator === '+' ? value + right : value - right);
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (current().type === '*' || current().type === '/') {
      const operator = current().type;
      index += 1;
      const right = parseUnary();
      if (operator === '/' && right === 0) throw new Error('除数不能为 0');
      value = ensureFinite(operator === '*' ? value * right : value / right);
    }
    return value;
  }

  function parseUnary() {
    if (current().type === '+') { index += 1; return parseUnary(); }
    if (current().type === '-') { index += 1; return ensureFinite(-parseUnary()); }
    return parsePower();
  }

  function parsePower() {
    let value = parsePostfix();
    if (current().type === '^') {
      index += 1;
      value = ensureFinite(Math.pow(value, parseUnary()));
    }
    return value;
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (current().type === '%') { index += 1; value /= 100; }
    return value;
  }

  function angle(value) {
    return mode === 'DEG' ? value * Math.PI / 180 : value;
  }

  function applyFunction(name, value) {
    if (!FUNCTIONS.has(name)) throw new Error('不支持的函数');
    if (name === 'sqrt') {
      if (value < 0) throw new Error('sqrt 定义域要求输入不小于 0');
      return Math.sqrt(value);
    }
    if (name === 'ln' || name === 'log') {
      if (value <= 0) throw new Error(name + ' 定义域要求输入大于 0');
      return name === 'ln' ? Math.log(value) : Math.log10(value);
    }
    const radians = angle(value);
    if (name === 'tan' && Math.abs(Math.cos(radians)) < 1e-12) throw new Error('tan 在该角度无定义');
    return name === 'sin' ? Math.sin(radians) : name === 'cos' ? Math.cos(radians) : Math.tan(radians);
  }

  function parsePrimary() {
    const token = current();
    if (token.type === 'number') { index += 1; return token.value; }
    if (token.type === '(') {
      index += 1;
      const value = parseExpression();
      consume(')');
      return value;
    }
    if (token.type === 'identifier') {
      index += 1;
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (!FUNCTIONS.has(token.value)) throw new Error('不支持的函数或常量');
      consume('(');
      const value = parseExpression();
      consume(')');
      return ensureFinite(applyFunction(token.value, value));
    }
    throw new Error('表达式格式不正确');
  }

  const result = ensureFinite(parseExpression());
  if (current().type !== 'eof') throw new Error('表达式格式不正确');
  return Math.abs(result) < 1e-15 ? 0 : result;
}

function formatNumber(value) {
  ensureFinite(value);
  const normalized = Math.abs(value) < 1e-15 ? 0 : value;
  if (Number.isInteger(normalized) && Math.abs(normalized) < 1e15) return String(normalized);
  return String(Number(normalized.toPrecision(15)));
}

module.exports = { evaluateExpression, formatNumber };
