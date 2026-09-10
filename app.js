const runtime = require('./config/runtime');

const LEGACY_TOOL_PAGES = {
  '/pages/lunar-convert/lunar-convert': '/package-calendar/pages/lunar-convert/lunar-convert',
  '/pages/zodiac/zodiac': '/package-calendar/pages/zodiac/zodiac'
};

const historyExtension = filePath => {
  const match = String(filePath || '').match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
};

const formatHistoryTime = timestamp => {
  const date = new Date(timestamp);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

App({
  globalData: {
    brand: '极团工具箱',
    recentKey: 'jituan_recent_tools',
    historyKey: 'jituan_operation_history',
    privacyVersion: runtime.privacyVersion
  },

  onLaunch() {
    if (wx.cloud && typeof wx.cloud.init === 'function') {
      const cloudOptions = { traceUser: true };
      if (runtime.cloudEnvId) cloudOptions.env = runtime.cloudEnvId;
      wx.cloud.init(cloudOptions);
    }
    const recent = wx.getStorageSync(this.globalData.recentKey);
    const iconMap = { '↘': 'compress', A: 'ocr', '▤': 'pdf' };
    if (Array.isArray(recent)) {
      wx.setStorageSync(this.globalData.recentKey, recent
        .filter(item => item && item.key !== 'ocr')
        .map(item => ({
          ...item,
          icon: iconMap[item.icon] || item.icon,
          page: this.normalizeToolPage(item.page)
        })));
    } else {
      wx.setStorageSync(this.globalData.recentKey, []);
    }
    const history = wx.getStorageSync(this.globalData.historyKey);
    if (!Array.isArray(history)) wx.setStorageSync(this.globalData.historyKey, []);
  },

  recordRecent(tool) {
    const key = this.globalData.recentKey;
    const iconMap = { '↘': 'compress', A: 'ocr', '▤': 'pdf' };
    const recent = (wx.getStorageSync(key) || []).map(item => ({ ...item, icon: iconMap[item.icon] || item.icon }));
    const normalizedTool = { ...tool, icon: iconMap[tool.icon] || tool.icon, page: this.normalizeToolPage(tool.page) };
    const next = [normalizedTool, ...recent.filter(item => item.key !== normalizedTool.key)].slice(0, 5);
    wx.setStorageSync(key, next);
  },

  getOperationHistory() {
    const history = wx.getStorageSync(this.globalData.historyKey);
    return Array.isArray(history) ? history.map(record => ({ ...record, page: this.normalizeToolPage(record.page) })) : [];
  },

  normalizeToolPage(page) {
    return LEGACY_TOOL_PAGES[page] || page;
  },

  getOperationRecord(recordId) {
    if (!recordId) return null;
    return this.getOperationHistory().find(record => String(record.id) === String(recordId)) || null;
  },

  saveHistoryFile(filePath, recordId, index, ownedPaths) {
    if (!filePath || typeof wx === 'undefined') return Promise.resolve(filePath || '');
    const fs = typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null;
    const userPath = wx.env && wx.env.USER_DATA_PATH;
    const extension = historyExtension(filePath);
    const fallback = () => new Promise(resolve => {
      if (typeof wx.saveFile !== 'function') return resolve(filePath);
      wx.saveFile({
        tempFilePath: filePath,
        success: result => resolve(result && result.savedFilePath ? result.savedFilePath : filePath),
        fail: () => resolve(filePath)
      });
    });
    if (!fs || !userPath || typeof fs.copyFile !== 'function') return fallback();
    const destination = `${userPath}/jituan-history-${recordId}-${index}${extension}`;
    return new Promise(resolve => fs.copyFile({
      srcPath: filePath,
      destPath: destination,
      success: () => { ownedPaths.push(destination); resolve(destination); },
      fail: () => fallback().then(resolve)
    }));
  },

  removeOwnedHistoryFiles(record) {
    const paths = record && Array.isArray(record.ownedPaths) ? record.ownedPaths : [];
    if (!paths.length || typeof wx.getFileSystemManager !== 'function') return;
    const fs = wx.getFileSystemManager();
    paths.forEach(filePath => {
      if (filePath && typeof fs.unlink === 'function') fs.unlink({ filePath, fail: () => {} });
    });
  },

  recordOperation(operation = {}) {
    const createdAt = Date.now();
    const recordId = `${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
    const ownedPaths = [];
    const savedPathCache = {};
    const savePath = (filePath, index) => {
      if (!filePath) return Promise.resolve('');
      if (!savedPathCache[filePath]) savedPathCache[filePath] = this.saveHistoryFile(filePath, recordId, index, ownedPaths);
      return savedPathCache[filePath];
    };
    const sourceFiles = Array.isArray(operation.files) ? operation.files : [];
    return Promise.all(sourceFiles.map((file, index) => Promise.all([
      savePath(file && file.path, `${index}-source`),
      savePath(file && file.outputPath, `${index}-output`)
    ]).then(paths => ({
      ...(file || {}),
      path: paths[0] || (file && file.path) || '',
      outputPath: paths[1] || (file && file.outputPath) || ''
    })))).then(files => {
      const previewPaths = [];
      files.forEach(file => [file.outputPath, file.path].forEach(path => {
        if (path && previewPaths.indexOf(path) === -1) previewPaths.push(path);
      }));
      const record = {
        ...operation,
        id: recordId,
        createdAt,
        timeText: formatHistoryTime(createdAt),
        files,
        fileCount: files.length,
        previewPath: previewPaths[0] || '',
        previewPaths,
        text: typeof operation.text === 'string' ? operation.text : '',
        textPreview: typeof operation.text === 'string' ? operation.text.slice(0, 180) : '',
        textTruncated: typeof operation.text === 'string' && operation.text.length > 180,
        ownedPaths
      };
      const history = this.getOperationHistory();
      const next = [record, ...history].slice(0, 20);
      history.slice(19).forEach(item => this.removeOwnedHistoryFiles(item));
      wx.setStorageSync(this.globalData.historyKey, next);
      return record;
    });
  },

  clearOperationHistory() {
    this.getOperationHistory().forEach(record => this.removeOwnedHistoryFiles(record));
    wx.removeStorageSync(this.globalData.historyKey);
  }
});
