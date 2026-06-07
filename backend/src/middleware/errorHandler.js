const { config } = require('../config/env');
const { ApiError } = require('../utils/apiError');

function notFound(req, res, next) {
  next(new ApiError(404, `接口不存在：${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

function errorHandler(err, req, res, next) {
  let error = err;

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError(413, '图片过大，请上传更小的图片', 'IMAGE_TOO_LARGE');
  }

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message: statusCode >= 500 && config.nodeEnv === 'production'
      ? '服务器内部错误'
      : error.message || '服务器内部错误'
  };

  if (error.details && config.nodeEnv !== 'production') {
    response.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFound,
  errorHandler
};
