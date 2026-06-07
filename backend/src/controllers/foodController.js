const { analyzeFoodImage } = require('../services/aiFoodAnalyzer');
const { ApiError } = require('../utils/apiError');

async function analyzeFood(req, res) {
  if (!req.file) {
    throw new ApiError(400, '请上传图片字段 image', 'IMAGE_REQUIRED');
  }

  const result = await analyzeFoodImage(req.file);

  res.json({
    success: true,
    data: result
  });
}

module.exports = { analyzeFood };
