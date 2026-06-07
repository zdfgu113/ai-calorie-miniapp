function compressImage(filePath, options = {}) {
  const quality = Number(options.quality || 70);

  return new Promise((resolve) => {
    if (!filePath || !wx.compressImage) {
      resolve({
        filePath,
        compressed: false
      });
      return;
    }

    wx.compressImage({
      src: filePath,
      quality,
      success(res) {
        resolve({
          filePath: res.tempFilePath || filePath,
          originalPath: filePath,
          compressed: Boolean(res.tempFilePath)
        });
      },
      fail() {
        resolve({
          filePath,
          originalPath: filePath,
          compressed: false
        });
      }
    });
  });
}

module.exports = { compressImage };
