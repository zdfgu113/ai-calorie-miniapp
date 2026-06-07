const { API_BASE_URL } = require('./config');

function uploadFoodImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/analyze-food`,
      filePath,
      name: 'image',
      timeout: 60000,
      success(res) {
        const body = parseResponse(res);
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
          resolve(body.data);
          return;
        }
        reject(new Error(body.message || '识别失败，请重试'));
      },
      fail(error) {
        reject(new Error(error.errMsg || '图片上传失败，请检查后端服务'));
      }
    });
  });
}

function saveRecord(record) {
  return request({
    url: '/api/records',
    method: 'POST',
    data: record
  });
}

function updateRecord(id, record) {
  return request({
    url: `/api/records/${id}`,
    method: 'PATCH',
    data: record
  });
}

function deleteRecord(id) {
  return request({
    url: `/api/records/${id}`,
    method: 'DELETE'
  });
}

function getTodayRecords() {
  return request({
    url: '/api/records/today',
    method: 'GET'
  });
}

function getRecordHistory(range) {
  return request({
    url: `/api/records/history?range=${range || 'today'}`,
    method: 'GET'
  });
}

function getRecordTrend(days = 7) {
  return request({
    url: `/api/records/trend?days=${days}`,
    method: 'GET'
  });
}

function getSettings() {
  return request({
    url: '/api/settings',
    method: 'GET'
  });
}

function updateSettings(settings) {
  return request({
    url: '/api/settings',
    method: 'PUT',
    data: settings
  });
}

function getDailyGoal() {
  return request({
    url: '/api/settings/daily-goal',
    method: 'GET'
  });
}

function updateDailyGoal(dailyGoalCalories) {
  return request({
    url: '/api/settings/daily-goal',
    method: 'PUT',
    data: {
      dailyGoalCalories
    }
  });
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: 60000,
      header: {
        'Content-Type': 'application/json'
      },
      success(res) {
        const body = parseResponse(res);
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
          resolve(body.data);
          return;
        }
        reject(new Error(body.message || `请求失败：${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '请求失败，请检查后端服务'));
      }
    });
  });
}

function parseResponse(res) {
  if (typeof res.data === 'object') {
    return res.data;
  }

  try {
    return JSON.parse(res.data);
  } catch (error) {
    return {
      success: false,
      message: '后端返回内容格式异常'
    };
  }
}

module.exports = {
  uploadFoodImage,
  saveRecord,
  updateRecord,
  deleteRecord,
  getTodayRecords,
  getRecordHistory,
  getRecordTrend,
  getSettings,
  updateSettings,
  getDailyGoal,
  updateDailyGoal
};
