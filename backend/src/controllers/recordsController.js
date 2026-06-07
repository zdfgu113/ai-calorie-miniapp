const {
  addRecord,
  updateRecord,
  deleteRecord,
  getTodaySummary,
  getHistorySummary,
  getTrend
} = require('../services/recordStore');

async function createRecord(req, res) {
  const record = await addRecord(req.body);

  res.status(201).json({
    success: true,
    data: record
  });
}

async function getTodayRecords(req, res) {
  const summary = await getTodaySummary();

  res.json({
    success: true,
    data: summary
  });
}

async function getHistoryRecords(req, res) {
  const summary = await getHistorySummary(req.query.range || 'today');

  res.json({
    success: true,
    data: summary
  });
}

async function getRecordsTrend(req, res) {
  const trend = await getTrend(req.query.days || 7);

  res.json({
    success: true,
    data: trend
  });
}

async function patchRecord(req, res) {
  const record = await updateRecord(req.params.id, req.body);

  res.json({
    success: true,
    data: record
  });
}

async function removeRecord(req, res) {
  const record = await deleteRecord(req.params.id);

  res.json({
    success: true,
    data: record
  });
}

module.exports = {
  createRecord,
  getTodayRecords,
  getHistoryRecords,
  getRecordsTrend,
  patchRecord,
  removeRecord
};
