const { config } = require('../config/env');
const { ApiError } = require('../utils/apiError');
const { getDb } = require('./database');

const DEFAULT_SETTINGS = {
  dailyGoalCalories: config.dailyCalorieGoal,
  heightCm: 170,
  weightKg: 65,
  fatLossGoal: 'steady'
};

const FAT_LOSS_GOALS = ['mild', 'steady', 'aggressive'];

async function getSettings(userId = null) {
  const db = await getDb();
  const rows = userId
    ? await db.all('SELECT key, value FROM user_settings WHERE user_id = ?', [userId])
    : await db.all('SELECT key, value FROM settings');
  const settings = { ...DEFAULT_SETTINGS };

  rows.forEach((row) => {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch (error) {
      settings[row.key] = row.value;
    }
  });

  return normalizeSettings(settings);
}

async function updateDailyGoal(input, userId = null) {
  return updateSettings({
    dailyGoalCalories: input.dailyGoalCalories
  }, userId);
}

async function updateSettings(input, userId = null) {
  const current = await getSettings(userId);
  const nextSettings = normalizeSettings({
    ...current,
    ...pickDefined(input, ['dailyGoalCalories', 'heightCm', 'weightKg', 'fatLossGoal'])
  });

  validateSettings(nextSettings);

  const db = await getDb();
  for (const [key, value] of Object.entries(nextSettings)) {
    if (userId) {
      await db.run(
        'INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)',
        [userId, key, JSON.stringify(value)]
      );
    } else {
      await db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, JSON.stringify(value)]
      );
    }
  }

  return nextSettings;
}

function normalizeSettings(settings) {
  return {
    dailyGoalCalories: toRoundedNumber(settings.dailyGoalCalories, DEFAULT_SETTINGS.dailyGoalCalories),
    heightCm: toRoundedNumber(settings.heightCm, DEFAULT_SETTINGS.heightCm),
    weightKg: toOneDecimal(settings.weightKg, DEFAULT_SETTINGS.weightKg),
    fatLossGoal: FAT_LOSS_GOALS.includes(settings.fatLossGoal)
      ? settings.fatLossGoal
      : DEFAULT_SETTINGS.fatLossGoal
  };
}

function validateSettings(settings) {
  if (settings.dailyGoalCalories < 800 || settings.dailyGoalCalories > 5000) {
    throw new ApiError(400, '每日目标热量需要在 800 到 5000 kcal 之间', 'INVALID_DAILY_GOAL');
  }

  if (settings.heightCm < 100 || settings.heightCm > 230) {
    throw new ApiError(400, '身高需要在 100 到 230 cm 之间', 'INVALID_HEIGHT');
  }

  if (settings.weightKg < 30 || settings.weightKg > 250) {
    throw new ApiError(400, '体重需要在 30 到 250 kg 之间', 'INVALID_WEIGHT');
  }
}

function pickDefined(input, keys) {
  const picked = {};

  keys.forEach((key) => {
    if (input && input[key] !== undefined) {
      picked[key] = input[key];
    }
  });

  return picked;
}

function toRoundedNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toOneDecimal(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : fallback;
}

module.exports = {
  getSettings,
  updateDailyGoal,
  updateSettings
};
