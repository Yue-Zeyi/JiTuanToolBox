const cloud = require('wx-server-sdk');
const { createPopularityHandler } = require('./handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION_NAME = 'tool_click_stats';
const database = cloud.database();
const command = database.command;
const collection = database.collection(COLLECTION_NAME);

const errorText = error => [error && error.code, error && error.errCode, error && error.message, error && error.errMsg].filter(Boolean).join(' ');
const isMissingCollection = error => /collection.*(?:not exist|not found)|集合.*不存在|DATABASE_COLLECTION_NOT_EXIST/i.test(errorText(error));
const isExistingCollection = error => /already exists|collection exists|集合已存在|DATABASE_COLLECTION_EXIST/i.test(errorText(error));

async function ensureCollection() {
  try {
    await database.createCollection(COLLECTION_NAME);
  } catch (error) {
    if (!isExistingCollection(error)) throw error;
  }
}

async function withCollection(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingCollection(error)) throw error;
    await ensureCollection();
    return operation();
  }
}

async function increment(toolKey) {
  return withCollection(async () => {
    const document = collection.doc(toolKey);
    const updated = await document.update({ data: { count: command.inc(1), updatedAt: database.serverDate() } });
    if (updated && updated.stats && updated.stats.updated) return;
    try {
      await collection.add({ data: { _id: toolKey, key: toolKey, count: 1, createdAt: database.serverDate(), updatedAt: database.serverDate() } });
    } catch (error) {
      const retry = await document.update({ data: { count: command.inc(1), updatedAt: database.serverDate() } });
      if (!retry || !retry.stats || !retry.stats.updated) throw error;
    }
  });
}

async function getTop(limit) {
  return withCollection(async () => {
    const result = await collection.where({ count: command.gt(0) }).orderBy('count', 'desc').limit(limit).get();
    return (result && result.data || []).map(item => ({ key: String(item.key || item._id || ''), count: Number(item.count) || 0 }));
  });
}

const handler = createPopularityHandler({ increment, getTop });

exports.main = async event => {
  try {
    return await handler(event, cloud.getWXContext());
  } catch (error) {
    console.error('[tool-popularity]', error);
    return { ok: false, code: 'POPULARITY_ERROR' };
  }
};
