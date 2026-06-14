const { ensureLogin } = require('./utils/auth');

App({
  onLaunch() {
    ensureLogin().catch(() => {
      // 先不打扰用户；保存记录、查看历史或设置时会再次尝试。
    });
  },

  globalData: {
    recordsChangedAt: 0
  }
});
