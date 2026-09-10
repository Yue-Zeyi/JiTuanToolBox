const { catalogTools } = require('./tool-catalog');

const SHARE_TITLE = '极团工具箱｜极简轻量，用完即走';
const SHARE_DESC = '极简轻量，用完即走';
const SHARE_IMAGE = '/assets/share-cover.jpg';

function normalizePath(value) {
  const path = String(value || '').trim();
  return path && path[0] === '/' ? path : (path ? `/${path}` : '');
}

function currentPagePath() {
  if (typeof getCurrentPages !== 'function') return '';
  const pages = getCurrentPages();
  const page = pages && pages[pages.length - 1];
  return page && page.route ? normalizePath(page.route) : '';
}

function findShareTool(path) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const exact = catalogTools.find(tool => normalizePath(tool.page) === normalized);
  if (exact) return exact;
  const base = normalized.split('?')[0];
  return catalogTools.find(tool => normalizePath(tool.page).split('?')[0] === base) || null;
}

function resolveToolShare(options) {
  if (options.tool === false) return null;
  if (options.tool && options.tool.title && options.tool.desc) return options.tool;
  return findShareTool(options.path || currentPagePath());
}

function toolShareTitle(tool) {
  return tool ? `${tool.title}｜${tool.desc}` : '';
}

function getShareAppMessage(options = {}) {
  const tool = resolveToolShare(options);
  return {
    title: options.title || toolShareTitle(tool) || SHARE_TITLE,
    desc: options.desc || (tool && tool.desc) || SHARE_DESC,
    path: options.path || '/pages/index/index',
    imageUrl: options.imageUrl || SHARE_IMAGE
  };
}

function getShareTimeline(options = {}) {
  const tool = resolveToolShare(options);
  return {
    title: options.title || toolShareTitle(tool) || SHARE_TITLE,
    query: options.query || '',
    imageUrl: options.imageUrl || SHARE_IMAGE
  };
}

module.exports = { SHARE_TITLE, SHARE_DESC, SHARE_IMAGE, getShareAppMessage, getShareTimeline, findShareTool };
