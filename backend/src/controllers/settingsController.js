const { getSettings, updateDailyGoal, updateSettings } = require('../services/settingsStore');

async function getDailyGoal(req, res) {
  const settings = await getSettings(req.user.id);

  res.json({
    success: true,
    data: settings
  });
}

async function setDailyGoal(req, res) {
  const settings = await updateDailyGoal(req.body, req.user.id);

  res.json({
    success: true,
    data: settings
  });
}

async function getAllSettings(req, res) {
  const settings = await getSettings(req.user.id);

  res.json({
    success: true,
    data: settings
  });
}

async function setAllSettings(req, res) {
  const settings = await updateSettings(req.body, req.user.id);

  res.json({
    success: true,
    data: settings
  });
}

module.exports = {
  getAllSettings,
  setAllSettings,
  getDailyGoal,
  setDailyGoal
};
