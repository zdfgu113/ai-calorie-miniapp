const { getTodayRecords } = require('../../utils/request');
const { compressImage } = require('../../utils/image');

Page({
  data: {
    error: '',
    dailyGoalCalories: 1800,
    totalCalories: 0,
    remainingCalories: 1800,
    absRemainingCalories: 1800,
    progressPercent: 0,
    recordCount: 0,
    loading: false,
    preparingImage: false
  },

  onShow() {
    this.syncTabBar();
    this.loadTodaySummary();
  },

  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  async loadTodaySummary() {
    this.setData({ loading: true, error: '' });

    try {
      const data = await getTodayRecords();
      const dailyGoalCalories = Number(data.dailyGoalCalories || 1800);
      const totalCalories = Number(data.totalCalories || 0);
      const remainingCalories = Number(data.remainingCalories || 0);
      const progressPercent = dailyGoalCalories > 0
        ? Math.min(100, Math.round((totalCalories / dailyGoalCalories) * 100))
        : 0;

      this.setData({
        dailyGoalCalories,
        totalCalories,
        remainingCalories,
        absRemainingCalories: Math.abs(remainingCalories),
        progressPercent,
        recordCount: (data.records || []).length
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载今日摘要失败'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleChooseImage() {
    if (this.data.preparingImage) return;

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) {
          this.setData({ error: '没有选择到有效图片' });
          return;
        }

        this.setData({ preparingImage: true, error: '' });

        try {
          const compressed = await compressImage(file.tempFilePath, { quality: 70 });
          await navigateTo(`/pages/analyze/analyze?imagePath=${encodeURIComponent(compressed.filePath)}`);
        } catch (error) {
          this.setData({
            error: error.message || '打开识别页面失败，请重试'
          });
        } finally {
          this.setData({ preparingImage: false });
        }
      },
      fail: (error) => {
        if (error.errMsg && error.errMsg.includes('cancel')) return;
        this.setData({ error: '选择图片失败，请重试' });
      }
    });
  },

  goRecords() {
    this.switchToTab('/pages/records/records');
  },

  goHistory() {
    this.switchToTab('/pages/history/history');
  },

  goSettings() {
    this.switchToTab('/pages/settings/settings');
  },

  switchToTab(url) {
    wx.switchTab({
      url,
      fail: () => {
        this.setData({ error: '页面打开失败，请重新点击一次' });
        wx.showToast({
          title: '页面打开失败',
          icon: 'none'
        });
      }
    });
  }
});

function navigateTo(url) {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url,
      success: resolve,
      fail() {
        reject(new Error('打开识别页面失败，请重试'));
      }
    });
  });
}
