const { ApiError } = require('./apiError');

const FOOD_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'foodName',
    'estimatedWeight',
    'calories',
    'protein',
    'fat',
    'carbs',
    'dietAdvice'
  ],
  properties: {
    foodName: {
      type: 'string',
      minLength: 1,
      maxLength: 60
    },
    estimatedWeight: {
      type: 'string',
      minLength: 1,
      maxLength: 30
    },
    calories: {
      type: 'number',
      minimum: 0
    },
    protein: {
      type: 'number',
      minimum: 0
    },
    fat: {
      type: 'number',
      minimum: 0
    },
    carbs: {
      type: 'number',
      minimum: 0
    },
    dietAdvice: {
      type: 'string',
      minLength: 1,
      maxLength: 180
    }
  }
};

function requiredString(input, key) {
  const value = input[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(422, `识别结果缺少有效字段：${key}`, 'INVALID_FOOD_RESULT');
  }
  return value.trim();
}

function requiredNumber(input, key, options = {}) {
  const value = Number(input[key]);
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError(422, `识别结果缺少有效数值：${key}`, 'INVALID_FOOD_RESULT');
  }

  if (options.integer) {
    return Math.round(value);
  }

  return Math.round(value * 10) / 10;
}

function normalizeFoodAnalysis(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(422, '识别结果不是有效 JSON 对象', 'INVALID_FOOD_RESULT');
  }

  return {
    foodName: requiredString(input, 'foodName'),
    estimatedWeight: requiredString(input, 'estimatedWeight'),
    calories: requiredNumber(input, 'calories', { integer: true }),
    protein: requiredNumber(input, 'protein'),
    fat: requiredNumber(input, 'fat'),
    carbs: requiredNumber(input, 'carbs'),
    dietAdvice: requiredString(input, 'dietAdvice')
  };
}

module.exports = {
  FOOD_ANALYSIS_SCHEMA,
  normalizeFoodAnalysis
};
