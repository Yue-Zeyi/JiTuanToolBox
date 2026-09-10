const { persistImageOutput } = require('./image-output');

function normalizeRotation(value) {
  return ((Math.round(Number(value) || 0) % 360) + 360) % 360;
}

function outputFormat(file) {
  const type = String(file && file.type || '').toLowerCase();
  const path = String(file && file.name || file && file.path || '').toLowerCase();
  return type.includes('png') || /\.png(?:$|[?#])/.test(path) ? 'png' : 'jpg';
}

function transformDimensions(width, height, rotation) {
  const rotated = normalizeRotation(rotation);
  return rotated === 90 || rotated === 270 ? { width: height, height: width } : { width, height };
}

function transformImage(file, options = {}) {
  const width = Math.max(1, Math.round(Number(file && file.width) || 0));
  const height = Math.max(1, Math.round(Number(file && file.height) || 0));
  if (!file || !file.path || !width || !height) return Promise.reject(new Error('无法读取原图尺寸，请重新选择图片'));
  if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return Promise.reject(new Error('当前微信版本不支持本地图片旋转'));
  const rotation = normalizeRotation(options.rotation);
  const flipX = Boolean(options.flipX);
  const flipY = Boolean(options.flipY);
  const format = outputFormat(file);
  const size = transformDimensions(width, height, rotation);
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery().select('#transformCanvas').fields({ node: true, size: true }).exec(response => {
      const canvas = response && response[0] && response[0].node;
      if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.createImage !== 'function') return reject(new Error('本地画布初始化失败，请重新进入工具'));
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      const image = canvas.createImage();
      image.onload = () => {
        try {
          context.clearRect(0, 0, size.width, size.height);
          if (format === 'jpg') {
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, size.width, size.height);
          }
          context.save();
          context.translate(size.width / 2, size.height / 2);
          context.rotate(rotation * Math.PI / 180);
          context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
          context.drawImage(image, -width / 2, -height / 2, width, height);
          context.restore();
          const exportImage = () => wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
            destWidth: size.width,
            destHeight: size.height,
            fileType: format,
            quality: format === 'jpg' ? 0.94 : 1,
            success: output => {
              if (!output || !output.tempFilePath) return reject(new Error('图片生成失败，请重试'));
              persistImageOutput(output.tempFilePath, 'jituan-image-transform', format).then(saved => {
                const done = bytes => resolve({ outputPath: saved.path, outputName: saved.name, outputFormat: format, width: size.width, height: size.height, bytes });
                if (typeof wx.getFileInfo !== 'function') return done(0);
                wx.getFileInfo({ filePath: saved.path, success: info => done(Number(info && info.size) || 0), fail: () => done(0) });
              }).catch(reject);
            },
            fail: () => reject(new Error('图片生成失败，请重试'))
          });
          if (typeof wx.nextTick === 'function') wx.nextTick(exportImage); else setTimeout(exportImage, 0);
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('原图读取失败，请重新选择图片'));
      image.src = file.path;
    });
  });
}

module.exports = { normalizeRotation, outputFormat, transformDimensions, transformImage };
