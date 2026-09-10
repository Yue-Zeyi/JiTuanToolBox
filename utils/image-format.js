const { persistImageOutput } = require('./image-output');

function convertImage(file, options = {}) {
  const width = Math.max(1, Math.round(Number(file && file.width) || 0));
  const height = Math.max(1, Math.round(Number(file && file.height) || 0));
  const format = options.format === 'png' ? 'png' : 'jpg';
  const quality = Math.max(40, Math.min(100, Number(options.quality) || 90));
  if (!file || !file.path || !width || !height) return Promise.reject(new Error('无法读取原图尺寸，请重新选择图片'));
  if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return Promise.reject(new Error('当前微信版本不支持本地格式转换'));
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery().select('#formatCanvas').fields({ node: true, size: true }).exec(response => {
      const canvas = response && response[0] && response[0].node;
      if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.createImage !== 'function') return reject(new Error('本地画布初始化失败，请重新进入工具'));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      const image = canvas.createImage();
      image.onload = () => {
        try {
          context.clearRect(0, 0, width, height);
          if (format === 'jpg') { context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, width, height); }
          context.drawImage(image, 0, 0, width, height);
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
            success: output => {
              if (!output || !output.tempFilePath) return reject(new Error('转换结果为空，请重试'));
              persistImageOutput(output.tempFilePath, 'jituan-image-format', format).then(saved => {
                const done = bytes => resolve({ outputPath: saved.path, outputName: saved.name, outputFormat: format, width, height, bytes });
                if (typeof wx.getFileInfo !== 'function') return done(0);
                wx.getFileInfo({ filePath: saved.path, success: info => done(Number(info && info.size) || 0), fail: () => done(0) });
              }).catch(reject);
            },
            fail: () => reject(new Error('格式转换失败，图片分辨率可能超出当前设备处理能力'))
          });
          if (typeof wx.nextTick === 'function') wx.nextTick(exportImage); else setTimeout(exportImage, 0);
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('原图读取失败，请重新选择图片'));
      image.src = file.path;
    });
  });
}

module.exports = { convertImage };
