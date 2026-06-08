const { randomBytes, randomUUID } = require('crypto');
const { config } = require('../config/env');
const { ApiError } = require('../utils/apiError');
const { getDb } = require('./database');

async function loginWithWechatCode(code) {
  if (!code) {
    throw new ApiError(400, '缺少微信登录 code', 'WECHAT_CODE_REQUIRED');
  }

  const wxSession = await exchangeWechatCode(code);
  const now = new Date().toISOString();
  const user = await upsertUser(wxSession, now);
  const session = await createSession(user.id, now);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id
    }
  };
}

async function verifySessionToken(token) {
  if (!token) {
    throw new ApiError(401, '请先微信登录', 'LOGIN_REQUIRED');
  }

  const db = await getDb();
  const row = await db.get(
    `SELECT sessions.token, sessions.expires_at, users.id AS user_id
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ?`,
    [token]
  );

  if (!row) {
    throw new ApiError(401, '登录已失效，请重新登录', 'SESSION_INVALID');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    throw new ApiError(401, '登录已过期，请重新登录', 'SESSION_EXPIRED');
  }

  return {
    id: row.user_id
  };
}

async function exchangeWechatCode(code) {
  if (config.wechat.mock) {
    return {
      openid: `mock-${code}`,
      unionid: null,
      sessionKey: 'mock-session-key'
    };
  }

  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw new ApiError(500, '后端未配置微信登录参数', 'WECHAT_CONFIG_MISSING');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', config.wechat.appId);
  url.searchParams.set('secret', config.wechat.appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const response = await fetch(url, { method: 'GET' });
  const body = await response.json();

  if (!response.ok || body.errcode) {
    throw new ApiError(
      502,
      body.errmsg || '微信登录校验失败',
      'WECHAT_LOGIN_FAILED',
      body
    );
  }

  if (!body.openid) {
    throw new ApiError(502, '微信登录未返回 openid', 'WECHAT_OPENID_MISSING', body);
  }

  return {
    openid: body.openid,
    unionid: body.unionid || null,
    sessionKey: body.session_key || ''
  };
}

async function upsertUser(wxSession, now) {
  const db = await getDb();
  const existing = await db.get('SELECT * FROM users WHERE openid = ?', [wxSession.openid]);

  if (existing) {
    await db.run(
      'UPDATE users SET unionid = ?, updated_at = ?, last_login_at = ? WHERE id = ?',
      [wxSession.unionid || existing.unionid || null, now, now, existing.id]
    );
    return {
      id: existing.id
    };
  }

  const user = {
    id: randomUUID(),
    openid: wxSession.openid,
    unionid: wxSession.unionid || null
  };

  await db.run(
    `INSERT INTO users (id, openid, unionid, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.openid, user.unionid, now, now, now]
  );

  return {
    id: user.id
  };
}

async function createSession(userId, now) {
  const db = await getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + config.auth.sessionTtlDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
  await db.run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [token, userId, now, expiresAt]
  );

  return {
    token,
    expiresAt
  };
}

module.exports = {
  loginWithWechatCode,
  verifySessionToken
};
