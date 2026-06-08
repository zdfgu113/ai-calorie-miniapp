const { getSettings, updateSettings } = require('../../utils/request');
const { ensureLogin, getCurrentUser } = require('../../utils/auth');

const GOAL_OPTIONS = [
  { key: 'mild', label: '轻度减脂', desc: '更容易坚持' },
  { key: 'steady', label: '稳步减脂', desc: '推荐节奏' },
  { key: 'aggressive', label: '快速减脂', desc: '更严格' }
];

Page({
  data: {
    goalOptions: GOAL_OPTIONS,
    dailyGoalCalories: '1800',
    heightCm: '170',
    weightKg: '65',
    fatLossGoal: 'steady',
    recommendedDailyCalories: 0,
    estimatedMaintenanceCalories: 0,
    recommendationText: '',
    loggedIn: false,
    userLabel: '未登录',
    authLoading: false,
    loading: false,
    saving: false,
    error: ''
  },

  onShow() {
    this.syncTabBar();
    this.syncAuthState();
    this.loadSettings();
  },

  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  syncAuthState() {
    const user = getCurrentUser();

    this.setData({
      loggedIn: !!user,
      userLabel: user && user.id ? `用户 ${maskUserId(user.id)}` : '未登录'
    });
  },

  async loginWithWechat() {
    if (this.data.authLoading) return;

    this.setData({ authLoading: true, error: '' });

    try {
      await ensureLogin(true);
      this.syncAuthState();
      await this.loadSettings();
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ error: error.message || '微信登录失败' });
    } finally {
      this.setData({ authLoading: false });
    }
  },

  async loadSettings() {
    this.setData({ loading: true, error: '' });

    try {
      const settings = await getSettings();
      this.syncAuthState();
      this.setData({
        dailyGoalCalories: String(settings.dailyGoalCalories || 1800),
        heightCm: String(settings.heightCm || 170),
        weightKg: String(settings.weightKg || 65),
        fatLossGoal: settings.fatLossGoal || 'steady',
        ...buildRecommendation({
          heightCm: settings.heightCm || 170,
          weightKg: settings.weightKg || 65,
          fatLossGoal: settings.fatLossGoal || 'steady'
        })
      });
    } catch (error) {
      this.setData({ error: error.message || '加载设置失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const nextData = {
      ...this.data,
      [field]: value
    };

    this.setData({
      [field]: value,
      ...buildRecommendation(nextData)
    });
  },

  selectGoal(event) {
    const fatLossGoal = event.currentTarget.dataset.goal;
    const nextData = {
      ...this.data,
      fatLossGoal
    };

    this.setData({
      fatLossGoal,
      ...buildRecommendation(nextData)
    });
  },

  adjustNumber(event) {
    const field = event.currentTarget.dataset.field;
    const step = Number(event.currentTarget.dataset.step || 0);
    const current = Number(this.data[field]);
    const next = Math.round((current + step) * 10) / 10;
    const nextData = {
      ...this.data,
      [field]: String(next)
    };

    this.setData({
      [field]: String(next),
      ...buildRecommendation(nextData)
    });
  },

  applyRecommendedGoal() {
    if (!this.data.recommendedDailyCalories) return;

    this.setData({
      dailyGoalCalories: String(this.data.recommendedDailyCalories)
    });

    wx.showToast({
      title: '已填入推荐值',
      icon: 'success'
    });
  },

  async saveSettings() {
    if (this.data.saving) return;

    const payload = {
      dailyGoalCalories: Number(this.data.dailyGoalCalories),
      heightCm: Number(this.data.heightCm),
      weightKg: Number(this.data.weightKg),
      fatLossGoal: this.data.fatLossGoal
    };
    const validationMessage = validateSettings(payload);

    if (validationMessage) {
      this.setData({ error: validationMessage });
      return;
    }

    this.setData({ saving: true, error: '' });

    try {
      const settings = await updateSettings(payload);
      getApp().globalData.recordsChangedAt = Date.now();
      this.setData({
        dailyGoalCalories: String(settings.dailyGoalCalories),
        heightCm: String(settings.heightCm),
        weightKg: String(settings.weightKg),
        fatLossGoal: settings.fatLossGoal
      });
      wx.showToast({
        title: '设置已保存',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ error: error.message || '保存设置失败' });
    } finally {
      this.setData({ saving: false });
    }
  }
});

function buildRecommendation(input) {
  const heightCm = Number(input.heightCm);
  const weightKg = Number(input.weightKg);
  const fatLossGoal = input.fatLossGoal || 'steady';

  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
    return {
      recommendedDailyCalories: 0,
      estimatedMaintenanceCalories: 0,
      recommendationText: '填好身高、体重和减脂目标后，会给出推荐热量。'
    };
  }

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * 30 - 80;
  const estimatedMaintenanceCalories = clamp(Math.round(bmr * 1.45), 1200, 4500);
  const deficitMap = {
    mild: 250,
    steady: 450,
    aggressive: 650
  };
  const recommendedDailyCalories = clamp(
    Math.round((estimatedMaintenanceCalories - (deficitMap[fatLossGoal] || 450)) / 10) * 10,
    1000,
    3800
  );
  const goalTextMap = {
    mild: '轻度减脂：更适合长期坚持',
    steady: '稳步减脂：推荐默认节奏',
    aggressive: '快速减脂：更严格，注意饥饿感'
  };

  return {
    recommendedDailyCalories,
    estimatedMaintenanceCalories,
    recommendationText: `${goalTextMap[fatLossGoal] || goalTextMap.steady}。这是基于身高体重的粗估值。`
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function maskUserId(userId) {
  if (!userId || userId.length <= 8) {
    return userId || '';
  }

  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

function validateSettings(settings) {
  if (!Number.isFinite(settings.dailyGoalCalories) || settings.dailyGoalCalories < 800 || settings.dailyGoalCalories > 5000) {
    return '目标热量需要在 800 到 5000 kcal 之间';
  }

  if (!Number.isFinite(settings.heightCm) || settings.heightCm < 100 || settings.heightCm > 230) {
    return '身高需要在 100 到 230 cm 之间';
  }

  if (!Number.isFinite(settings.weightKg) || settings.weightKg < 30 || settings.weightKg > 250) {
    return '体重需要在 30 到 250 kg 之间';
  }

  return '';
}
