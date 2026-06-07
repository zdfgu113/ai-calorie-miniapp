const express = require('express');
const {
  createRecord,
  getTodayRecords,
  getHistoryRecords,
  getRecordsTrend,
  patchRecord,
  removeRecord
} = require('../controllers/recordsController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post('/', asyncHandler(createRecord));
router.get('/today', asyncHandler(getTodayRecords));
router.get('/history', asyncHandler(getHistoryRecords));
router.get('/trend', asyncHandler(getRecordsTrend));
router.patch('/:id', asyncHandler(patchRecord));
router.delete('/:id', asyncHandler(removeRecord));

module.exports = router;
