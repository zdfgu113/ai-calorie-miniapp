const express = require('express');
const { getAllSettings, setAllSettings, getDailyGoal, setDailyGoal } = require('../controllers/settingsController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(getAllSettings));
router.put('/', asyncHandler(setAllSettings));
router.get('/daily-goal', asyncHandler(getDailyGoal));
router.put('/daily-goal', asyncHandler(setDailyGoal));

module.exports = router;
