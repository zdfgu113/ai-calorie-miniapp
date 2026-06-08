const { loginWithWechatCode } = require('../services/authStore');

async function login(req, res) {
  const session = await loginWithWechatCode(req.body.code);

  res.json({
    success: true,
    data: session
  });
}

module.exports = {
  login
};
