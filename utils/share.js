const SHARE_TITLE = '极团工具箱｜极简轻量，用完即走';
const SHARE_DESC = '极简轻量，用完即走';
const SHARE_IMAGE = '/assets/share-cover.jpg';

function getShareAppMessage(options = {}) {
  return {
    title: options.title || SHARE_TITLE,
    desc: options.desc || SHARE_DESC,
    path: options.path || '/pages/index/index',
    imageUrl: options.imageUrl || SHARE_IMAGE
  };
}

function getShareTimeline(options = {}) {
  return {
    title: options.title || SHARE_TITLE,
    query: options.query || '',
    imageUrl: options.imageUrl || SHARE_IMAGE
  };
}

module.exports = { SHARE_TITLE, SHARE_DESC, SHARE_IMAGE, getShareAppMessage, getShareTimeline };
