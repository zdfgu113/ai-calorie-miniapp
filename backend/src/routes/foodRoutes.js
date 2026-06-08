const express = require('express');
const multer = require('multer');
const { config } = require('../config/env');
const { analyzeFood } = require('../controllers/foodController');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/apiError');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxSizeBytes
  },
  fileFilter(req, file, callback) {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      callback(new ApiError(400, '只支持上传图片文件', 'INVALID_IMAGE_TYPE'));
      return;
    }
    callback(null, true);
  }
});

router.post('/analyze-food', asyncHandler(requireAuth), upload.single('image'), asyncHandler(analyzeFood));

module.exports = router;
