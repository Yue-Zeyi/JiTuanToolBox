const { compressFile, discardCompressionResults } = require('./image-compression');
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_RESIZE_DIMENSION = 4096;
const MAX_SPLIT_PARTS = 100;
const MAX_STITCH_IMAGES = 20;
const MAX_STITCH_DIMENSION = 4096;
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'jfif', 'jpe'];
const STITCH_LAYOUTS = ['vertical', 'horizontal', 'grid'];
const STITCH_GAPS = [0, 8, 16, 24];
const STITCH_BACKGROUNDS = ['white', 'light', 'dark', 'transparent'];

function safeSize(size) {
  return Number(size) > 0 ? Number(size) : 1024 * 1024;
}

function imageExtension(file) {
  const sources = [file && file.name, file && file.path, file && file.tempFilePath].filter(Boolean);
  for (let index = 0; index < sources.length; index += 1) {
    const match = String(sources[index]).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
    if (match) return match[1].toLowerCase();
  }
  return '';
}

function validateImageFile(file) {
  if (!file || !file.path) throw new Error(`${file && file.name ? file.name : '图片'}路径为空，请重新选择`);
  if (Number(file.size) > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 20MB');
  const extension = imageExtension(file);
  if (extension && SUPPORTED_IMAGE_EXTENSIONS.indexOf(extension) === -1) {
    throw new Error('当前图片格式暂不支持，请选择 JPG、JPEG、PNG、BMP、WEBP、JFIF 或 JPE 图片');
  }
}

function outputFormatFor(file, format) {
  if (format === 'png' || format === 'jpg') return format;
  const type = String(file && file.type || '').toLowerCase();
  return (imageExtension(file) === 'png' || type.indexOf('png') !== -1) ? 'png' : 'jpg';
}

function mockResize(file, options, index) {
  const width = Number(options.width);
  const height = Number(options.height);
  const originalBytes = safeSize(file.size);
  const ratio = Math.max(.2, Math.min(1, (width * height) / Math.max(1, (Number(file.width) || width) * (Number(file.height) || height))));
  return Promise.resolve({
    ...file,
    id: `${Date.now()}-${index}`,
    width,
    height,
    originalBytes,
    compressedBytes: Math.round(originalBytes * ratio),
    outputPath: file.path,
    outputFormat: outputFormatFor(file, options.format),
    fitMode: options.fitMode || 'stretch',
    requestedQuality: Number(options.quality) || 88
  });
}

function drawResizeCanvas(context, image, file, width, height, fitMode, format) {
  const sourceWidth = Math.max(1, Number(file && file.width) || Number(image && image.width) || width);
  const sourceHeight = Math.max(1, Number(file && file.height) || Number(image && image.height) || height);
  context.clearRect(0, 0, width, height);
  // JPG 没有透明通道，等比适配时用白色补边；PNG 保留透明区域。
  if (format !== 'png') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
  }
  if (fitMode === 'stretch') {
    context.drawImage(image, 0, 0, width, height);
    return;
  }
  if (fitMode === 'cover') {
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const cropX = Math.max(0, (sourceWidth - cropWidth) / 2);
    const cropY = Math.max(0, (sourceHeight - cropHeight) / 2);
    context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
    return;
  }
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function resizeImage(file, options = {}, pageContext, index = 0) {
  try {
    validateImageFile(file);
  } catch (error) {
    return Promise.reject(error);
  }
  const width = Math.round(Number(options.width));
  const height = Math.round(Number(options.height));
  if (!width || !height || width < 1 || height < 1 || width > MAX_RESIZE_DIMENSION || height > MAX_RESIZE_DIMENSION) {
    return Promise.reject(new Error(`尺寸需在 1 至 ${MAX_RESIZE_DIMENSION}px 之间`));
  }
  const format = outputFormatFor(file, options.format);
  const quality = Math.max(20, Math.min(100, Number(options.quality) || 88));
  const fitMode = ['contain', 'cover', 'stretch'].indexOf(options.fitMode) === -1 ? 'stretch' : options.fitMode;
  const canUseCanvas2d = typeof wx !== 'undefined' && typeof wx.createSelectorQuery === 'function' && pageContext;
  if (!canUseCanvas2d) return mockResize(file, { width, height, format, quality, fitMode }, index);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    try {
      // 页面实例不应传给 selectorQuery.in（该方法仅用于限定自定义组件范围）。
      // 服务层从页面调用时使用全局查询即可，避免真机上取不到 2D Canvas 节点。
      const query = wx.createSelectorQuery();
      query.select('#resizeCanvas').fields({ node: true, size: true }).exec(response => {
        const canvasInfo = response && response[0];
        const canvas = canvasInfo && canvasInfo.node;
        if (!canvas || typeof canvas.getContext !== 'function') return finish(new Error('本地画布初始化失败，请重新进入尺寸修改'));
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context || typeof canvas.createImage !== 'function') return finish(new Error('当前微信版本不支持本地尺寸处理'));
        const image = canvas.createImage();
        image.onload = () => {
          try {
            context.imageSmoothingEnabled = true;
            drawResizeCanvas(context, image, file, width, height, fitMode, format);
            const exportImage = () => wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
              width,
              height,
              destWidth: width,
              destHeight: height,
              fileType: format,
              quality: format === 'jpg' ? quality / 100 : 1,
              success: result => {
                if (!result || !result.tempFilePath) return finish(new Error('尺寸修改结果为空，请重新选择图片'));
                const originalBytes = safeSize(file.size);
                const complete = output => finish(null, {
                  ...file,
                  id: `${Date.now()}-${index}`,
                  width,
                  height,
                  originalBytes,
                  compressedBytes: output,
                  outputPath: result.tempFilePath,
                  outputFormat: format,
                  fitMode,
                  requestedQuality: quality
                });
                if (typeof wx.getFileInfo !== 'function') return complete(Math.round(originalBytes * .7));
                wx.getFileInfo({ filePath: result.tempFilePath, success: info => complete(info && info.size ? info.size : Math.round(originalBytes * .7)), fail: () => complete(Math.round(originalBytes * .7)) });
              },
              fail: error => finish(new Error(error && error.errMsg ? error.errMsg : '尺寸修改失败'))
            });
            if (typeof wx.nextTick === 'function') wx.nextTick(exportImage); else setTimeout(exportImage, 0);
          } catch (error) {
            finish(error);
          }
        };
        image.onerror = () => finish(new Error('原图读取失败，请重新选择图片'));
        image.src = file.path;
      });
    } catch (error) {
      finish(error);
    }
  });
}

function normalizeSplitGrid(options = {}) {
  const rows = Math.round(Number(options.rows));
  const cols = Math.round(Number(options.cols));
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 10 || cols > 10 || rows * cols > MAX_SPLIT_PARTS) {
    throw new Error(`拆分行列需在 1 至 10 之间，且总块数不超过 ${MAX_SPLIT_PARTS} 块`);
  }
  return { rows, cols };
}

function mockSplit(file, options) {
  const { rows, cols } = normalizeSplitGrid(options);
  const outputFormat = outputFormatFor(file, options.format);
  const total = rows * cols;
  const originalBytes = safeSize(file.size);
  const sourceWidth = Math.max(1, Math.round(Number(file.width) || cols));
  const sourceHeight = Math.max(1, Math.round(Number(file.height) || rows));
  return Promise.resolve(Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / cols);
    const column = index % cols;
    return {
      ...file,
      id: `${Date.now()}-${index}`,
      tileIndex: index + 1,
      row: row + 1,
      column: column + 1,
      rows,
      cols,
      width: Math.max(1, Math.round(sourceWidth / cols)),
      height: Math.max(1, Math.round(sourceHeight / rows)),
      originalBytes,
      compressedBytes: Math.max(1, Math.round(originalBytes / total)),
      outputPath: file.path,
      outputFormat
    };
  }));
}

function splitImage(file, options = {}, pageContext, onProgress) {
  try {
    validateImageFile(file);
  } catch (error) {
    return Promise.reject(error);
  }
  let grid;
  try {
    grid = normalizeSplitGrid(options);
  } catch (error) {
    return Promise.reject(error);
  }
  const outputFormat = outputFormatFor(file, options.format);
  const quality = Math.max(20, Math.min(100, Number(options.quality) || 88));
  if (typeof wx === 'undefined') return mockSplit(file, { ...options, ...grid, format: outputFormat, quality });
  const canUseCanvas2d = typeof wx.createSelectorQuery === 'function' && pageContext;
  if (!canUseCanvas2d) return Promise.reject(new Error('当前微信版本不支持本地图片拆分'));
  const sourceWidth = Math.round(Number(file.width));
  const sourceHeight = Math.round(Number(file.height));
  if (!sourceWidth || !sourceHeight) return Promise.reject(new Error('无法读取原图尺寸，请重新选择图片'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    try {
      const query = wx.createSelectorQuery();
      query.select('#splitCanvas').fields({ node: true, size: true }).exec(response => {
        const canvasInfo = response && response[0];
        const canvas = canvasInfo && canvasInfo.node;
        if (!canvas || typeof canvas.getContext !== 'function') return finish(new Error('本地画布初始化失败，请重新进入图片拆块'));
        const context = canvas.getContext('2d');
        if (!context || typeof canvas.createImage !== 'function') return finish(new Error('当前微信版本不支持本地图片拆分'));
        const image = canvas.createImage();
        image.onload = () => {
          const outputs = [];
          const total = grid.rows * grid.cols;
          const processPart = index => {
            if (index >= total) return finish(null, outputs);
            const row = Math.floor(index / grid.cols);
            const column = index % grid.cols;
            const sourceX = Math.round(column * sourceWidth / grid.cols);
            const sourceY = Math.round(row * sourceHeight / grid.rows);
            const sourceRight = Math.round((column + 1) * sourceWidth / grid.cols);
            const sourceBottom = Math.round((row + 1) * sourceHeight / grid.rows);
            const partWidth = Math.max(1, sourceRight - sourceX);
            const partHeight = Math.max(1, sourceBottom - sourceY);
            canvas.width = partWidth;
            canvas.height = partHeight;
            context.clearRect(0, 0, partWidth, partHeight);
            if (outputFormat !== 'png') {
              context.fillStyle = '#FFFFFF';
              context.fillRect(0, 0, partWidth, partHeight);
            }
            context.drawImage(image, sourceX, sourceY, partWidth, partHeight, 0, 0, partWidth, partHeight);
            const exportPart = () => wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
              width: partWidth,
              height: partHeight,
              destWidth: partWidth,
              destHeight: partHeight,
              fileType: outputFormat,
              quality: outputFormat === 'jpg' ? quality / 100 : 1,
              success: result => {
                if (!result || !result.tempFilePath) return finish(new Error(`第 ${index + 1} 块图片生成失败`));
                const completePart = compressedBytes => {
                  outputs.push({
                    ...file,
                    id: `${Date.now()}-${index}`,
                    tileIndex: index + 1,
                    row: row + 1,
                    column: column + 1,
                    rows: grid.rows,
                    cols: grid.cols,
                    width: partWidth,
                    height: partHeight,
                    originalBytes: safeSize(file.size),
                    compressedBytes,
                    outputPath: result.tempFilePath,
                    outputFormat,
                    requestedQuality: quality
                  });
                  if (typeof onProgress === 'function') onProgress({ completed: index + 1, total, current: `第 ${row + 1} 行 · 第 ${column + 1} 列` });
                  if (typeof wx.nextTick === 'function') wx.nextTick(() => processPart(index + 1)); else setTimeout(() => processPart(index + 1), 0);
                };
                if (typeof wx.getFileInfo !== 'function') return completePart(Math.max(1, Math.round(safeSize(file.size) / total)));
                wx.getFileInfo({ filePath: result.tempFilePath, success: info => completePart(info && info.size ? info.size : Math.max(1, Math.round(safeSize(file.size) / total))), fail: () => completePart(Math.max(1, Math.round(safeSize(file.size) / total))) });
              },
              fail: error => finish(new Error(error && error.errMsg ? error.errMsg : `第 ${index + 1} 块图片生成失败`))
            });
            if (typeof wx.nextTick === 'function') wx.nextTick(exportPart); else setTimeout(exportPart, 0);
          };
          processPart(0);
        };
        image.onerror = () => finish(new Error('原图读取失败，请重新选择图片'));
        image.src = file.path;
      });
    } catch (error) {
      finish(error);
    }
  });
}

function normalizeStitchOptions(options = {}) {
  const mode = STITCH_LAYOUTS.indexOf(options.mode) === -1 ? 'vertical' : options.mode;
  const rawGap = Math.round(Number(options.gap));
  const gap = STITCH_GAPS.indexOf(rawGap) === -1 ? 16 : rawGap;
  const rawFileCount = Math.round(Number(options.fileCount));
  const fileCount = Number.isFinite(rawFileCount) && rawFileCount >= 1 ? Math.min(MAX_STITCH_IMAGES, rawFileCount) : MAX_STITCH_IMAGES;
  const maxGridCols = Math.max(1, fileCount);
  const rawGridCols = Math.round(Number(options.gridCols));
  const gridCols = Number.isFinite(rawGridCols) ? Math.max(1, Math.min(maxGridCols, rawGridCols)) : Math.min(2, maxGridCols);
  const background = STITCH_BACKGROUNDS.indexOf(options.background) === -1 ? 'white' : options.background;
  const format = options.format === 'png' || options.format === 'jpg' ? options.format : 'auto';
  const quality = Math.max(20, Math.min(100, Number(options.quality) || 88));
  return { mode, gap, gridCols, fileCount, background, format, quality };
}

function stitchSizes(files) {
  return files.map(file => ({
    width: Math.max(1, Math.round(Number(file && file.width) || 1)),
    height: Math.max(1, Math.round(Number(file && file.height) || 1))
  }));
}

function buildStitchLayout(sizes, options = {}) {
  const config = normalizeStitchOptions(options);
  const count = sizes.length;
  if (!count) return { width: 1, height: 1, placements: [], rows: 0, cols: 0, scale: 1, ...config };
  const safeSizes = sizes.map(item => ({ width: Math.max(1, Number(item.width) || 1), height: Math.max(1, Number(item.height) || 1) }));
  let rawWidth = 1;
  let rawHeight = 1;
  let rows = 1;
  let cols = count;
  let placements = [];

  if (config.mode === 'horizontal') {
    rawWidth = safeSizes.reduce((sum, item) => sum + item.width, 0) + config.gap * Math.max(0, count - 1);
    rawHeight = Math.max(...safeSizes.map(item => item.height));
    let x = 0;
    placements = safeSizes.map(item => {
      const placement = { x, y: (rawHeight - item.height) / 2, width: item.width, height: item.height };
      x += item.width + config.gap;
      return placement;
    });
  } else if (config.mode === 'grid') {
    cols = Math.min(config.gridCols, count);
    rows = Math.ceil(count / cols);
    const cellWidth = Math.max(...safeSizes.map(item => item.width));
    const cellHeight = Math.max(...safeSizes.map(item => item.height));
    rawWidth = cellWidth * cols + config.gap * Math.max(0, cols - 1);
    rawHeight = cellHeight * rows + config.gap * Math.max(0, rows - 1);
    placements = safeSizes.map((item, index) => {
      const column = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: column * (cellWidth + config.gap) + (cellWidth - item.width) / 2,
        y: row * (cellHeight + config.gap) + (cellHeight - item.height) / 2,
        width: item.width,
        height: item.height
      };
    });
  } else {
    rawWidth = Math.max(...safeSizes.map(item => item.width));
    rawHeight = safeSizes.reduce((sum, item) => sum + item.height, 0) + config.gap * Math.max(0, count - 1);
    let y = 0;
    placements = safeSizes.map(item => {
      const placement = { x: (rawWidth - item.width) / 2, y, width: item.width, height: item.height };
      y += item.height + config.gap;
      return placement;
    });
  }

  const scale = Math.min(1, MAX_STITCH_DIMENSION / Math.max(rawWidth, rawHeight));
  return {
    ...config,
    rows,
    cols,
    scale,
    width: Math.max(1, Math.round(rawWidth * scale)),
    height: Math.max(1, Math.round(rawHeight * scale)),
    placements: placements.map(item => ({
      x: Math.round(item.x * scale),
      y: Math.round(item.y * scale),
      width: Math.max(1, Math.round(item.width * scale)),
      height: Math.max(1, Math.round(item.height * scale))
    }))
  };
}

function stitchBackgroundColor(background, outputFormat) {
  if (background === 'transparent' && outputFormat === 'png') return '';
  if (background === 'dark') return '#1D2638';
  if (background === 'light') return '#F4F6F9';
  return '#FFFFFF';
}

function mockStitch(files, options = {}) {
  const config = normalizeStitchOptions({ ...options, fileCount: files.length });
  const layout = buildStitchLayout(stitchSizes(files), config);
  const outputFormat = outputFormatFor(files[0], config.format);
  const originalBytes = files.reduce((sum, file) => sum + safeSize(file && file.size), 0);
  const ratio = config.format === 'png' || (config.format === 'auto' && outputFormat === 'png') ? .86 : .68;
  return Promise.resolve({
    id: `${Date.now()}-stitch`,
    outputPath: files[0].path,
    outputFormat,
    width: layout.width,
    height: layout.height,
    originalBytes,
    compressedBytes: Math.max(1, Math.round(originalBytes * ratio)),
    fileCount: files.length,
    layoutMode: config.mode,
    rows: layout.rows,
    cols: layout.cols,
    gap: config.gap,
    background: config.background,
    scale: layout.scale
  });
}

function stitchImages(files, options = {}, pageContext, onProgress) {
  if (!Array.isArray(files) || files.length < 2 || files.length > MAX_STITCH_IMAGES) {
    return Promise.reject(new Error(`请至少选择 2 张图片，最多 ${MAX_STITCH_IMAGES} 张`));
  }
  try {
    files.forEach(validateImageFile);
  } catch (error) {
    return Promise.reject(error);
  }
  const config = normalizeStitchOptions({ ...options, fileCount: files.length });
  if (typeof wx === 'undefined') return mockStitch(files, config);
  const canUseCanvas2d = typeof wx.createSelectorQuery === 'function' && pageContext;
  if (!canUseCanvas2d) return Promise.reject(new Error('当前微信版本不支持本地图片拼接'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(result);
    };
    try {
      const query = wx.createSelectorQuery();
      query.select('#stitchCanvas').fields({ node: true, size: true }).exec(response => {
        const canvasInfo = response && response[0];
        const canvas = canvasInfo && canvasInfo.node;
        if (!canvas || typeof canvas.getContext !== 'function') return finish(new Error('本地画布初始化失败，请重新进入图片拼接'));
        if (typeof canvas.createImage !== 'function') return finish(new Error('当前微信版本不支持本地图片拼接'));
        const totalProgress = files.length + 2;
        const report = (completed, current) => {
          if (typeof onProgress === 'function') onProgress({ completed, total: totalProgress, current });
        };
        const loadImage = (file, index) => new Promise((resolveImage, rejectImage) => {
          const image = canvas.createImage();
          image.onload = () => {
            report(index + 1, file.name || `第 ${index + 1} 张图片`);
            resolveImage(image);
          };
          image.onerror = () => rejectImage(new Error(`${file.name || `第 ${index + 1} 张图片`}读取失败`));
          image.src = file.path;
        });
        Promise.all(files.map((file, index) => loadImage(file, index))).then(images => {
          const sizes = images.map((image, index) => ({
            width: Math.max(1, Math.round(Number(files[index].width) || Number(image.width) || 1)),
            height: Math.max(1, Math.round(Number(files[index].height) || Number(image.height) || 1))
          }));
          const layout = buildStitchLayout(sizes, config);
          const outputFormat = outputFormatFor(files[0], config.format);
          canvas.width = layout.width;
          canvas.height = layout.height;
          const context = canvas.getContext('2d');
          if (!context) return finish(new Error('本地画布初始化失败，请重新进入图片拼接'));
          context.clearRect(0, 0, layout.width, layout.height);
          const backgroundColor = stitchBackgroundColor(config.background, outputFormat);
          if (backgroundColor) {
            context.fillStyle = backgroundColor;
            context.fillRect(0, 0, layout.width, layout.height);
          }
          layout.placements.forEach((placement, index) => {
            const source = sizes[index];
            context.drawImage(images[index], 0, 0, source.width, source.height, placement.x, placement.y, placement.width, placement.height);
          });
          report(files.length + 1, '正在生成拼接图片');
          const exportCanvas = () => wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: layout.width,
            height: layout.height,
            destWidth: layout.width,
            destHeight: layout.height,
            fileType: outputFormat,
            quality: outputFormat === 'jpg' ? config.quality / 100 : 1,
            success: result => {
              if (!result || !result.tempFilePath) return finish(new Error('拼接结果为空，请重新选择图片'));
              const originalBytes = files.reduce((sum, file) => sum + safeSize(file && file.size), 0);
              const complete = compressedBytes => {
                report(totalProgress, '拼接完成');
                finish(null, {
                  id: `${Date.now()}-stitch`,
                  outputPath: result.tempFilePath,
                  outputFormat,
                  width: layout.width,
                  height: layout.height,
                  originalBytes,
                  compressedBytes,
                  fileCount: files.length,
                  layoutMode: config.mode,
                  rows: layout.rows,
                  cols: layout.cols,
                  gap: config.gap,
                  background: config.background,
                  scale: layout.scale
                });
              };
              if (typeof wx.getFileInfo !== 'function') return complete(Math.max(1, Math.round(originalBytes * (outputFormat === 'png' ? .86 : .68))));
              wx.getFileInfo({ filePath: result.tempFilePath, success: info => complete(info && info.size ? info.size : Math.max(1, Math.round(originalBytes * (outputFormat === 'png' ? .86 : .68)))), fail: () => complete(Math.max(1, Math.round(originalBytes * (outputFormat === 'png' ? .86 : .68)))) });
            },
            fail: error => finish(new Error(error && error.errMsg ? error.errMsg : '图片拼接失败'))
          });
          if (typeof wx.nextTick === 'function') wx.nextTick(exportCanvas); else setTimeout(exportCanvas, 0);
        }).catch(error => finish(error));
      });
    } catch (error) {
      finish(error);
    }
  });
}

async function compressImages(files, options = 80, onProgress, isCancelled) {
  const config = typeof options === 'number' ? { mode: 'custom', quality: options } : options;
  if (!Array.isArray(files) || !files.length) throw new Error('请先选择图片');
  files.forEach(validateImageFile);
  if (!config || !['target', 'auto', 'custom'].includes(config.mode)) throw new Error('请选择有效的压缩模式');
  if (config.mode === 'target' && (!Number.isFinite(Number(config.targetSizeKB)) || Number(config.targetSizeKB) < 80 || Number(config.targetSizeKB) > 20 * 1024)) throw new Error('目标大小需在 80 KB 至 20 MB 之间');
  const results = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let result;
    try {
      result = await compressFile(file, config, index, typeof wx === 'undefined' ? null : wx, isCancelled);
    } catch (error) {
      discardCompressionResults(results, typeof wx === 'undefined' ? null : wx, files.map(item => item.path));
      const reason = error && error.message ? error.message : '图片压缩失败';
      throw new Error(`${file.name || `第 ${index + 1} 张图片`}：${reason}`);
    }
    results.push(result);
    if (typeof onProgress === 'function') onProgress({ completed: index + 1, total: files.length, current: file.name });
  }
  return results;
}

const PDF_PAGE_SIZES = {
  a4: { width: 595, height: 842 },
  a5: { width: 420, height: 595 },
  letter: { width: 612, height: 792 }
};

const PDF_MARGINS = { none: 0, small: 18, standard: 36 };

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}

function normalizePdfOptions(options = {}) {
  const pageSize = ['auto', 'a4', 'a5', 'letter', 'custom'].indexOf(options.pageSize) === -1 ? 'auto' : options.pageSize;
  const orientation = ['auto', 'portrait', 'landscape'].indexOf(options.orientation) === -1 ? 'auto' : options.orientation;
  const fit = ['contain', 'cover', 'stretch'].indexOf(options.fit) === -1 ? 'contain' : options.fit;
  const margin = ['none', 'small', 'standard'].indexOf(options.margin) === -1 ? 'small' : options.margin;
  const customWidth = clampNumber(options.customWidth, 50, 500, 210);
  const customHeight = clampNumber(options.customHeight, 50, 500, 297);
  return { pageSize, orientation, fit, margin, customWidth, customHeight };
}

function pdfPageSize(options, sourceWidth, sourceHeight) {
  const config = normalizePdfOptions(options);
  let base;
  if (config.pageSize === 'custom') {
    base = { width: config.customWidth * 72 / 25.4, height: config.customHeight * 72 / 25.4 };
  } else {
    base = { ...(PDF_PAGE_SIZES[config.pageSize] || PDF_PAGE_SIZES.a4) };
  }
  const imageLandscape = Number(sourceWidth) >= Number(sourceHeight);
  const landscape = config.orientation === 'landscape' || (config.orientation === 'auto' && imageLandscape);
  if (landscape && base.height > base.width) return { width: base.height, height: base.width };
  if (!landscape && base.width > base.height) return { width: base.height, height: base.width };
  return base;
}

function asciiBytes(value) {
  const text = String(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 255;
  return bytes;
}

function base64ToBytes(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(value || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const output = new Uint8Array(Math.max(0, Math.floor(clean.length * 3 / 4) - (clean.endsWith('==') ? 2 : (clean.endsWith('=') ? 1 : 0))));
  let outputIndex = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = alphabet.indexOf(clean[index + 2]);
    const d = alphabet.indexOf(clean[index + 3]);
    const value24 = ((a < 0 ? 0 : a) << 18) | ((b < 0 ? 0 : b) << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (outputIndex < output.length) output[outputIndex++] = (value24 >> 16) & 255;
    if (outputIndex < output.length && clean[index + 2] !== '=') output[outputIndex++] = (value24 >> 8) & 255;
    if (outputIndex < output.length && clean[index + 3] !== '=') output[outputIndex++] = value24 & 255;
  }
  return output;
}

function bytesToBase64(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    result += alphabet[a >> 2];
    result += alphabet[((a & 3) << 4) | (b >> 4)];
    result += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    result += hasC ? alphabet[c & 63] : '=';
  }
  return result;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
  return output;
}

function buildPdfDocument(pages) {
  const chunks = [];
  const offsets = [0];
  let offset = 0;
  const pushText = text => { const bytes = asciiBytes(text); chunks.push(bytes); offset += bytes.length; };
  const pushBytes = bytes => { chunks.push(bytes); offset += bytes.length; };
  const object = (id, body) => { offsets[id] = offset; pushText(`${id} 0 obj\n${body}\nendobj\n`); };
  const pageIds = pages.map((page, index) => 3 + index * 3);
  const maxId = 2 + pages.length * 3;
  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const imageBytes = base64ToBytes(page.jpegBase64);
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.pageWidth.toFixed(2)} ${page.pageHeight.toFixed(2)}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    offsets[imageId] = offset;
    pushText(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
    pushBytes(imageBytes);
    pushText('\nendstream\nendobj\n');
    const content = `q\n${page.drawWidth.toFixed(2)} 0 0 ${page.drawHeight.toFixed(2)} ${page.drawX.toFixed(2)} ${page.drawY.toFixed(2)} cm\n/Im${index + 1} Do\nQ\n`;
    offsets[contentId] = offset;
    pushText(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  });
  const xrefOffset = offset;
  pushText(`xref\n0 ${maxId + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index <= maxId; index += 1) pushText(`${String(offsets[index] || 0).padStart(10, '0')} 00000 n \n`);
  pushText(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return bytesToBase64(concatBytes(chunks));
}

function readFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function') return reject(new Error('当前微信版本不支持本地文件读取'));
    wx.getFileSystemManager().readFile({ filePath, encoding: 'base64', success: result => resolve(result.data || ''), fail: error => reject(new Error(error && error.errMsg ? error.errMsg : '本地图片读取失败')) });
  });
}

function getCanvasNode(selector) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return reject(new Error('当前微信版本不支持本地画布'));
      wx.createSelectorQuery().select(selector).fields({ node: true, size: true }).exec(response => {
        const info = response && response[0];
        if (!info || !info.node || typeof info.node.getContext !== 'function') return reject(new Error('本地画布初始化失败，请重新进入页面'));
        resolve(info.node);
      });
    } catch (error) { reject(error); }
  });
}

function loadCanvasImage(canvas, path) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('原图读取失败，请重新选择图片'));
    image.src = path;
  });
}

function canvasToJpeg(canvas, width, height, quality = .9) {
  return new Promise((resolve, reject) => {
    const exportCanvas = () => wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width, height, destWidth: width, destHeight: height, fileType: 'jpg', quality, success: result => {
      if (!result || !result.tempFilePath) return reject(new Error('本地图片导出失败'));
      readFileBase64(result.tempFilePath).then(base64 => resolve({ path: result.tempFilePath, base64 })).catch(reject);
    }, fail: error => reject(new Error(error && error.errMsg ? error.errMsg : '本地图片导出失败')) });
    if (typeof wx.nextTick === 'function') wx.nextTick(exportCanvas); else setTimeout(exportCanvas, 0);
  });
}

function renderPdfPage(canvas, file, options) {
  return loadCanvasImage(canvas, file.path).then(image => {
    const sourceWidth = Math.max(1, Math.round(Number(file.width) || Number(image.width) || 1));
    const sourceHeight = Math.max(1, Math.round(Number(file.height) || Number(image.height) || 1));
    const page = pdfPageSize(options, sourceWidth, sourceHeight);
    const margin = PDF_MARGINS[normalizePdfOptions(options).margin];
    const contentWidth = Math.max(1, page.width - margin * 2);
    const contentHeight = Math.max(1, page.height - margin * 2);
    const fit = normalizePdfOptions(options).fit;
    const sourceRatio = sourceWidth / sourceHeight;
    const contentRatio = contentWidth / contentHeight;
    let drawWidth = contentWidth;
    let drawHeight = contentHeight;
    let drawX = margin;
    let drawY = margin;
    if (fit === 'contain') {
      const scale = Math.min(contentWidth / sourceWidth, contentHeight / sourceHeight);
      drawWidth = sourceWidth * scale; drawHeight = sourceHeight * scale;
      drawX += (contentWidth - drawWidth) / 2; drawY += (contentHeight - drawHeight) / 2;
    }
    const pixelScale = Math.min(2, 1800 / Math.max(1, Math.max(drawWidth, drawHeight)));
    const outputWidth = Math.max(1, Math.round(drawWidth * pixelScale));
    const outputHeight = Math.max(1, Math.round(drawHeight * pixelScale));
    canvas.width = outputWidth; canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('本地画布初始化失败');
    context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, outputWidth, outputHeight);
    if (fit === 'cover') {
      const scale = Math.max(outputWidth / sourceWidth, outputHeight / sourceHeight);
      const cropWidth = outputWidth / scale; const cropHeight = outputHeight / scale;
      context.drawImage(image, Math.max(0, (sourceWidth - cropWidth) / 2), Math.max(0, (sourceHeight - cropHeight) / 2), cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    } else {
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    }
    return canvasToJpeg(canvas, outputWidth, outputHeight, .9).then(output => ({
      jpegBase64: output.base64, imageWidth: outputWidth, imageHeight: outputHeight,
      pageWidth: page.width, pageHeight: page.height, drawX, drawY: page.height - drawY - drawHeight,
      drawWidth, drawHeight, sourceRatio, contentRatio
    }));
  });
}

function imagesToPdf(files, options = {}, pageContext, onProgress) {
  if (!Array.isArray(files) || !files.length) return Promise.reject(new Error('请先选择图片'));
  if (files.length > MAX_STITCH_IMAGES) return Promise.reject(new Error(`最多选择 ${MAX_STITCH_IMAGES} 张图片`));
  try { files.forEach(validateImageFile); } catch (error) { return Promise.reject(error); }
  if (typeof wx === 'undefined' || !pageContext) {
    const size = Math.max(512, Math.round(files.reduce((sum, file) => sum + safeSize(file && file.size), 0) * .38));
    return Promise.resolve({ name: `极团工具箱-${Date.now()}.pdf`, count: files.length, size, outputPath: files[0].path, url: files[0].path, pageSize: normalizePdfOptions(options).pageSize });
  }
  return getCanvasNode('#pdfCanvas').then(canvas => {
    const pages = [];
    const process = index => {
      if (index >= files.length) return Promise.resolve();
      if (typeof onProgress === 'function') onProgress({ completed: index, total: files.length + 1, current: `正在处理第 ${index + 1} 页` });
      return renderPdfPage(canvas, files[index], options).then(page => { pages.push(page); return process(index + 1); });
    };
    return process(0).then(() => {
      const pdfBase64 = buildPdfDocument(pages);
      const basePath = wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : String(files[0].path || '').replace(/[\\/][^\\/]*$/, '');
      const filePath = `${basePath}/jituan-${Date.now()}.pdf`;
      return new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager();
        fs.writeFile({ filePath, data: pdfBase64, encoding: 'base64', success: () => {
          if (typeof onProgress === 'function') onProgress({ completed: files.length + 1, total: files.length + 1, current: 'PDF 已生成' });
          const finish = size => resolve({ name: `极团工具箱-${Date.now()}.pdf`, count: files.length, size, outputPath: filePath, url: filePath, pageSize: normalizePdfOptions(options).pageSize, orientation: normalizePdfOptions(options).orientation, fit: normalizePdfOptions(options).fit, margin: normalizePdfOptions(options).margin });
          if (typeof wx.getFileInfo !== 'function') return finish(Math.max(512, Math.round(pdfBase64.length * .75)));
          wx.getFileInfo({ filePath, success: info => finish(Number(info && info.size) || Math.max(512, Math.round(pdfBase64.length * .75))), fail: () => finish(Math.max(512, Math.round(pdfBase64.length * .75))) });
        }, fail: error => reject(new Error(error && error.errMsg ? error.errMsg : 'PDF 文件写入失败')) });
      });
    });
  });
}

const WATERMARK_POSITIONS = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right', 'tile'];

function normalizeWatermarkOptions(options = {}) {
  const position = WATERMARK_POSITIONS.indexOf(options.position) === -1 ? 'bottom-right' : options.position;
  const outputFormat = options.outputFormat === 'png' ? 'png' : 'jpg';
  return {
    text: String(options.text || '').trim().slice(0, 80),
    fontSize: clampNumber(options.fontSize, 16, 160, 44),
    color: /^#[0-9a-f]{6}$/i.test(String(options.color || '')) ? String(options.color) : '#FFFFFF',
    opacity: clampNumber(options.opacity, .1, 1, .55),
    position,
    rotate: clampNumber(options.rotate, -45, 45, -18),
    spacing: clampNumber(options.spacing, 40, 600, 220),
    outputFormat,
    quality: clampNumber(options.quality, 40, 100, 90)
  };
}

function drawWatermark(context, width, height, config) {
  if (!config.text) return;
  const fontSize = Math.max(16, Math.round(config.fontSize));
  context.save();
  context.globalAlpha = config.opacity;
  context.fillStyle = config.color;
  context.font = `600 ${fontSize}px sans-serif`;
  context.textBaseline = 'middle';
  const textWidth = Math.max(fontSize, context.measureText(config.text).width);
  const margin = Math.max(28, Math.round(Math.min(width, height) * .04));
  const drawOne = (x, y) => { context.save(); context.translate(x, y); context.rotate(config.rotate * Math.PI / 180); context.fillText(config.text, -textWidth / 2, 0); context.restore(); };
  if (config.position === 'tile') {
    const stepX = textWidth + config.spacing;
    const stepY = fontSize * 3 + config.spacing * .45;
    for (let y = -height; y < height * 2; y += stepY) for (let x = -width; x < width * 2; x += stepX) drawOne(x + ((Math.round(y / stepY) % 2) ? stepX / 2 : 0), y);
  } else {
    const x = config.position.indexOf('left') !== -1 ? margin + textWidth / 2 : (config.position.indexOf('right') !== -1 ? width - margin - textWidth / 2 : width / 2);
    const y = config.position.indexOf('top') !== -1 ? margin + fontSize / 2 : (config.position.indexOf('bottom') !== -1 ? height - margin - fontSize / 2 : height / 2);
    drawOne(x, y);
  }
  context.restore();
}

function watermarkImage(file, options = {}, pageContext) {
  try { validateImageFile(file); } catch (error) { return Promise.reject(error); }
  const config = normalizeWatermarkOptions(options);
  if (!config.text) return Promise.reject(new Error('请输入水印文字'));
  if (typeof wx === 'undefined' || !pageContext) return Promise.resolve({ outputPath: file.path, outputFormat: config.outputFormat, width: Number(file.width) || 1200, height: Number(file.height) || 800, originalBytes: safeSize(file.size), compressedBytes: Math.round(safeSize(file.size) * .9), text: config.text, position: config.position });
  return getCanvasNode('#watermarkCanvas').then(canvas => loadCanvasImage(canvas, file.path).then(image => {
    const sourceWidth = Math.max(1, Math.round(Number(file.width) || Number(image.width) || 1));
    const sourceHeight = Math.max(1, Math.round(Number(file.height) || Number(image.height) || 1));
    const scale = Math.min(1, MAX_STITCH_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('本地画布初始化失败，请重新进入页面');
    context.clearRect(0, 0, width, height);
    if (config.outputFormat === 'jpg') { context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    drawWatermark(context, width, height, { ...config, fontSize: config.fontSize * scale, spacing: config.spacing * scale });
    return new Promise((resolve, reject) => {
      const exportCanvas = () => wx.canvasToTempFilePath({ canvas, x: 0, y: 0, width, height, destWidth: width, destHeight: height, fileType: config.outputFormat, quality: config.outputFormat === 'jpg' ? config.quality / 100 : 1, success: result => {
        if (!result || !result.tempFilePath) return reject(new Error('水印结果为空，请重新选择图片'));
        const finish = size => resolve({ outputPath: result.tempFilePath, outputFormat: config.outputFormat, width, height, originalBytes: safeSize(file.size), compressedBytes: size, text: config.text, position: config.position, opacity: config.opacity });
        if (typeof wx.getFileInfo !== 'function') return finish(Math.round(safeSize(file.size) * .9));
        wx.getFileInfo({ filePath: result.tempFilePath, success: info => finish(Number(info && info.size) || Math.round(safeSize(file.size) * .9)), fail: () => finish(Math.round(safeSize(file.size) * .9)) });
      }, fail: error => reject(new Error(error && error.errMsg ? error.errMsg : '图片加水印失败')) });
      if (typeof wx.nextTick === 'function') wx.nextTick(exportCanvas); else setTimeout(exportCanvas, 0);
    });
  }));
}

module.exports = { compressImages, resizeImage, splitImage, stitchImages, imagesToPdf, watermarkImage, MAX_IMAGE_BYTES, MAX_RESIZE_DIMENSION, MAX_SPLIT_PARTS, MAX_STITCH_IMAGES, MAX_STITCH_DIMENSION, SUPPORTED_IMAGE_EXTENSIONS };
