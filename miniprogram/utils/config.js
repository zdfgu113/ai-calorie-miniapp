const DEV_API_BASE_URL = 'http://127.0.0.1:3000';
const PROD_API_BASE_URL = 'https://your-api-domain.example.com';

function getApiBaseUrl() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion;

    if (envVersion === 'release' || envVersion === 'trial') {
      return PROD_API_BASE_URL;
    }
  } catch (error) {
    // 本地脚本检查时没有 wx 对象，保持开发地址即可。
  }

  return DEV_API_BASE_URL;
}

const API_BASE_URL = getApiBaseUrl();

module.exports = {
  API_BASE_URL,
  DEV_API_BASE_URL,
  PROD_API_BASE_URL
};
