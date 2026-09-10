function normalizeFormat(format) {
  const value = String(format || '').toLowerCase().replace(/^image\//, '').replace(/^\./, '');
  if (value === 'jpeg' || value === 'jpe' || value === 'jfif') return 'jpg';
  if (value === 'bmp') return 'bmp';
  if (value === 'webp') return 'webp';
  if (value === 'png') return 'png';
  return 'jpg';
}

function outputName(baseName, format, timestamp = Date.now()) {
  const cleanBase = String(baseName || 'jituan-image')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '') || 'jituan-image';
  return `${cleanBase}-${timestamp}.${normalizeFormat(format)}`;
}

function pathName(filePath) {
  return String(filePath || '').split(/[\\/]/).pop() || '';
}

function explicitOutputName(fileName, format) {
  const expected = normalizeFormat(format);
  const source = pathName(fileName).replace(/[?#].*$/, '');
  const stem = source.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
  return `${stem || 'jituan-image'}.${expected}`;
}

function persistImageOutput(tempPath, baseName, format) {
  const sourcePath = String(tempPath || '');
  if (!sourcePath) return Promise.reject(new Error('结果文件为空，请重试'));
  const extension = normalizeFormat(format);
  const fallbackName = outputName(baseName, extension);
  const fs = typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function'
    ? wx.getFileSystemManager()
    : null;
  const userPath = typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH;
  if (!fs || !userPath || typeof fs.copyFile !== 'function') {
    return Promise.resolve({ path: sourcePath, name: fallbackName });
  }
  const name = outputName(baseName, extension);
  const destination = `${userPath}/${name}`;
  return new Promise(resolve => fs.copyFile({
    srcPath: sourcePath,
    destPath: destination,
    success: () => resolve({ path: destination, name }),
    fail: () => resolve({ path: sourcePath, name: fallbackName })
  }));
}

function saveNamedImageToAlbum(filePath, baseName, format, fileName) {
  const sourcePath = String(filePath || '');
  if (!sourcePath) return Promise.reject(new Error('当前没有可保存的图片'));
  if (typeof wx === 'undefined' || typeof wx.saveImageToPhotosAlbum !== 'function') {
    return Promise.reject(new Error('当前微信版本不支持保存到相册'));
  }
  const name = fileName ? explicitOutputName(fileName, format) : outputName(baseName, format);
  const fs = typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null;
  const userPath = wx.env && wx.env.USER_DATA_PATH;
  const destination = fs && userPath && typeof fs.copyFile === 'function' ? `${userPath}/${name}` : '';

  return new Promise((resolve, reject) => {
    let albumPath = sourcePath;
    let copied = false;
    const cleanup = () => {
      if (!copied || !fs || typeof fs.unlink !== 'function') return;
      fs.unlink({ filePath: destination, fail: () => {} });
    };
    const save = () => wx.saveImageToPhotosAlbum({
      filePath: albumPath,
      success: () => { cleanup(); resolve({ name }); },
      fail: error => { cleanup(); reject(error || new Error('保存失败')); }
    });
    if (!destination || destination === sourcePath) return save();
    fs.copyFile({
      srcPath: sourcePath,
      destPath: destination,
      success: () => { albumPath = destination; copied = true; save(); },
      fail: save
    });
  });
}

module.exports = { normalizeFormat, outputName, explicitOutputName, persistImageOutput, saveNamedImageToAlbum };
