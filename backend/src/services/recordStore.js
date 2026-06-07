const { randomUUID } = require('crypto');
const { getLocalDateKey, getDateRange, getRecentDateKeys, getShortDateLabel } = require('../utils/date');
const { ApiError } = require('../utils/apiError');
const { normalizeFoodAnalysis } = require('../utils/foodSchema');
const { getSettings } = require('./settingsStore');
const { getDb } = require('./database');

async function addRecord(input) {
  const food = normalizeFoodAnalysis(input);
  const now = new Date();
  const record = {
    id: randomUUID(),
    ...food,
    date: getLocalDateKey(now),
    createdAt: now.toISOString(),
    updatedAt: null
  };

  const db = await getDb();
  await db.run(
    `INSERT INTO records (
      id, food_name, estimated_weight, calories, protein, fat, carbs,
      diet_advice, date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toRecordParams(record)
  );

  return record;
}

async function updateRecord(id, input) {
  if (!id) {
    throw new ApiError(400, '缺少记录 ID', 'RECORD_ID_REQUIRED');
  }

  const food = normalizeFoodAnalysis(input);
  const db = await getDb();
  const existing = await getRecordById(id);

  if (!existing) {
    throw new ApiError(404, '没有找到这条饮食记录', 'RECORD_NOT_FOUND');
  }

  const updatedRecord = {
    ...existing,
    ...food,
    updatedAt: new Date().toISOString()
  };

  await db.run(
    `UPDATE records SET
      food_name = ?,
      estimated_weight = ?,
      calories = ?,
      protein = ?,
      fat = ?,
      carbs = ?,
      diet_advice = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      updatedRecord.foodName,
      updatedRecord.estimatedWeight,
      updatedRecord.calories,
      updatedRecord.protein,
      updatedRecord.fat,
      updatedRecord.carbs,
      updatedRecord.dietAdvice,
      updatedRecord.updatedAt,
      id
    ]
  );

  return updatedRecord;
}

async function deleteRecord(id) {
  if (!id) {
    throw new ApiError(400, '缺少记录 ID', 'RECORD_ID_REQUIRED');
  }

  const db = await getDb();
  const existing = await getRecordById(id);

  if (!existing) {
    throw new ApiError(404, '没有找到这条饮食记录', 'RECORD_NOT_FOUND');
  }

  await db.run('DELETE FROM records WHERE id = ?', [id]);
  return existing;
}

async function getTodaySummary() {
  return getRangeSummary('today');
}

async function getHistorySummary(range = 'today') {
  return getRangeSummary(range);
}

async function getTrend(days = 7) {
  const dateKeys = getRecentDateKeys(days);
  const startDate = dateKeys[0];
  const endDate = dateKeys[dateKeys.length - 1];
  const db = await getDb();
  const rows = await db.all(
    `SELECT date, SUM(calories) AS totalCalories
     FROM records
     WHERE date BETWEEN ? AND ?
     GROUP BY date`,
    [startDate, endDate]
  );
  const totalsByDate = new Map(rows.map((row) => [row.date, Number(row.totalCalories || 0)]));
  const maxCalories = Math.max(...dateKeys.map((date) => totalsByDate.get(date) || 0), 1);

  return {
    days: dateKeys.length,
    startDate,
    endDate,
    maxCalories,
    items: dateKeys.map((date) => {
      const totalCalories = totalsByDate.get(date) || 0;

      return {
        date,
        label: getShortDateLabel(date),
        totalCalories,
        barPercent: Math.max(totalCalories > 0 ? 8 : 0, Math.round((totalCalories / maxCalories) * 100))
      };
    })
  };
}

async function getRangeSummary(range) {
  const dateRange = getDateRange(range);
  const records = await listRecordsByDateRange(dateRange.startDate, dateRange.endDate);
  const totalCalories = records.reduce((sum, record) => sum + Number(record.calories || 0), 0);
  const settings = await getSettings();
  const dailyGoalCalories = settings.dailyGoalCalories;
  const daysCount = countDaysInclusive(dateRange.startDate, dateRange.endDate);
  const targetCalories = dailyGoalCalories * daysCount;
  const remainingCalories = targetCalories - totalCalories;

  return {
    ...dateRange,
    daysCount,
    dailyGoalCalories,
    targetCalories,
    totalCalories,
    remainingCalories,
    records
  };
}

async function listRecordsByDateRange(startDate, endDate) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT *
     FROM records
     WHERE date BETWEEN ? AND ?
     ORDER BY created_at DESC`,
    [startDate, endDate]
  );

  return rows.map(fromRecordRow);
}

async function getRecordById(id) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM records WHERE id = ?', [id]);
  return row ? fromRecordRow(row) : null;
}

function fromRecordRow(row) {
  return {
    id: row.id,
    foodName: row.food_name,
    estimatedWeight: row.estimated_weight,
    calories: Number(row.calories || 0),
    protein: Number(row.protein || 0),
    fat: Number(row.fat || 0),
    carbs: Number(row.carbs || 0),
    dietAdvice: row.diet_advice,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRecordParams(record) {
  return [
    record.id,
    record.foodName,
    record.estimatedWeight,
    record.calories,
    record.protein,
    record.fat,
    record.carbs,
    record.dietAdvice,
    record.date,
    record.createdAt,
    record.updatedAt
  ];
}

function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diffMs / 86400000) + 1);
}

module.exports = {
  addRecord,
  updateRecord,
  deleteRecord,
  getTodaySummary,
  getHistorySummary,
  getTrend
};
