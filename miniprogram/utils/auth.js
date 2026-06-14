const { API_BASE_URL } = require('./config');

const TOKEN_KEY = 'xiaoxiaoyouyu_session_token';
const USER_KEY = 'xiaoxiaoyouyu_user';
const EXPIRES_AT_KEY = 'xiaoxiaoyouyu_session_expires_at';

let loginPromise = null;

function ensureLogin(force = false) {
  if (!force && hasValidSession()) {
    return Promise.resolve(getSession());
  }

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = syncWechatIdentity()
    .finally(() => {
      loginPromise = null;
    });

  return loginPromise;
}

function syncWechatIdentity() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('身份同步失败，请稍后重试'));
          return;
        }

        wx.request({
          url: `${API_BASE_URL}/api/auth/login`,
          method: 'POST',
          data: {
            code: loginRes.code
          },
          timeout: 12000,
          header: {
            'Content-Type': 'application/json'
          },
          success(res) {
            const body = parseResponse(res);
            if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
              const session = body.data || {};
              saveSession(session);
              resolve(getSession());
              return;
            }

            reject(new Error(body.message || '身份同步失败'));
          },
          fail(error) {
            reject(new Error(formatLoginError(error)));
          }
        });
      },
      fail() {
        reject(new Error('身份同步失败，请检查微信状态'));
      }
    });
  });
}

function saveSession(session) {
  wx.setStorageSync(TOKEN_KEY, session.token || '');
  wx.setStorageSync(USER_KEY, session.user || null);
  wx.setStorageSync(EXPIRES_AT_KEY, session.expiresAt || '');
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.removeStorageSync(EXPIRES_AT_KEY);
}

function getSession() {
  return {
    token: wx.getStorageSync(TOKEN_KEY) || '',
    user: wx.getStorageSync(USER_KEY) || null,
    expiresAt: wx.getStorageSync(EXPIRES_AT_KEY) || ''
  };
}

function getCurrentUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function getSessionToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function hasValidSession() {
  const token = getSessionToken();
  const expiresAt = wx.getStorageSync(EXPIRES_AT_KEY) || '';

  if (!token || !expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() > Date.now() + 60000;
}

function getAuthHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function formatLoginError(error) {
  const errMsg = error && error.errMsg ? error.errMsg : '';

  if (errMsg.includes('timeout')) {
    return '身份同步超时，请稍后重试';
  }

  return '身份同步失败，请检查网络后重试';
}

module.exports = {
  ensureLogin,
  clearSession,
  getCurrentUser,
  getSession,
  getSessionToken,
  getAuthHeader
};
