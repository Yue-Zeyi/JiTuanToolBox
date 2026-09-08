const { createWechatRandomSource, randomIndex } = require('./password');

const MIN_TOSSES = 1;
const MAX_TOSSES = 100;
const MAX_SESSION_TOSSES = 10000;
const MAX_LABEL_LENGTH = 6;

function normalizeLabel(value) {
  const label = String(value || '').trim();
  if (/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(label)) throw new Error('硬币文案不能包含控制字符');
  if (Array.from(label).length > MAX_LABEL_LENGTH) throw new Error(`硬币文案最多 ${MAX_LABEL_LENGTH} 个字符`);
  return label;
}

function prepareCoinSettings(value = {}) {
  const count = Number(value.count === undefined ? 1 : value.count);
  if (!Number.isInteger(count) || count < MIN_TOSSES || count > MAX_TOSSES) throw new Error(`连抛次数须为 ${MIN_TOSSES}-${MAX_TOSSES} 的整数`);
  return { count, frontLabel: normalizeLabel(value.frontLabel), backLabel: normalizeLabel(value.backLabel) };
}

function ratio(value, total) {
  return total ? Math.round(value * 1000 / total) / 10 : 0;
}

async function tossCoins(countValue, readBytes) {
  const count = prepareCoinSettings({ count: countValue }).count;
  if (typeof readBytes !== 'function') throw new Error('安全随机数获取失败，请更新微信后重试');
  const results = [];
  for (let index = 0; index < count; index++) {
    const side = await randomIndex(2, async () => {
      const bytes = await readBytes(1);
      if (!(bytes instanceof Uint8Array) || bytes.length !== 1) throw new Error('安全随机数获取失败，请更新微信后重试');
      return bytes[0];
    });
    results.push(side === 0 ? 'front' : 'back');
  }
  const frontCount = results.filter(value => value === 'front').length;
  const backCount = results.length - frontCount;
  return {
    results,
    frontCount,
    backCount,
    frontRatio: ratio(frontCount, results.length),
    backRatio: ratio(backCount, results.length),
    last: results[results.length - 1]
  };
}

function summarizeSession(batches) {
  const summary = (Array.isArray(batches) ? batches : []).reduce((total, batch) => {
    total.total += Array.isArray(batch.results) ? batch.results.length : 0;
    total.frontCount += Number(batch.frontCount) || 0;
    total.backCount += Number(batch.backCount) || 0;
    return total;
  }, { total: 0, frontCount: 0, backCount: 0 });
  return { ...summary, frontRatio: ratio(summary.frontCount, summary.total), backRatio: ratio(summary.backCount, summary.total) };
}

function appendBatch(batches, batch) {
  const current = Array.isArray(batches) ? batches : [];
  if (!batch || !Array.isArray(batch.results)) throw new Error('批次结果无效');
  if (summarizeSession(current).total + batch.results.length > MAX_SESSION_TOSSES) throw new Error(`当前会话最多保留 ${MAX_SESSION_TOSSES} 次结果，请先清空会话`);
  return current.concat([{ ...batch, results: batch.results.slice() }]);
}

module.exports = {
  MIN_TOSSES,
  MAX_TOSSES,
  MAX_SESSION_TOSSES,
  MAX_LABEL_LENGTH,
  prepareCoinSettings,
  tossCoins,
  summarizeSession,
  appendBatch,
  createWechatRandomSource
};
