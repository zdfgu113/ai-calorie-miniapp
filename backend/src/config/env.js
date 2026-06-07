const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const maxUploadSizeMb = toNumber(process.env.MAX_UPLOAD_SIZE_MB, 8);

const config = {
  port: toNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  dailyCalorieGoal: toNumber(process.env.DAILY_CALORIE_GOAL, 1800),
  sqliteDbPath: process.env.SQLITE_DB_PATH || '',
  upload: {
    maxSizeBytes: maxUploadSizeMb * 1024 * 1024
  },
  ai: {
    mock: toBoolean(process.env.AI_MOCK, false),
    apiBaseUrl: process.env.AI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: toNumber(process.env.AI_TIMEOUT_MS, 60000),
    responseFormat: process.env.AI_RESPONSE_FORMAT || 'json_schema',
    thinking: process.env.AI_THINKING || ''
  }
};

module.exports = { config };
