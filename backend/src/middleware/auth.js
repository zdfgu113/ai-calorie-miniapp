const { verifySessionToken } = require('../services/authStore');

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    req.user = await verifySessionToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return '';
  }

  return header.slice('Bearer '.length).trim();
}

module.exports = {
  requireAuth
};
