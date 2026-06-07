const { getRecordHistory, getRecordTrend } = require('../../utils/request');

const RANGE_OPTIONS = [
  { key: 'yesterday', label: '昨天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' }
];

Page({
  data: {
    ranges: RANGE_OPTIONS,
    activeRange: 'yesterday',
    label: '昨天',
    startDate: '',
    endDate: '',
    totalCalories: 0,
    targetCalories: 0,
    remainingCalories: 0,
    absRemainingCalories: 0,
    records: [],
    trendItems: [],
    maxCalories: 1,
    loading: false,
    error: '',
    isEmpty: true
  },

  onShow() {
    this.syncTabBar();
    this.loadPageData();
  },

  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  switchRange(event) {
    const range = event.currentTarget.dataset.range;

    if (range === this.data.activeRange) return;

    this.setData({ activeRange: range });
    this.loadHistory();
  },

  async loadPageData() {
    this.setData({ loading: true, error: '' });

    try {
      await Promise.all([this.loadTrend(), this.loadHistory(false)]);
    } catch (error) {
      this.setData({ error: error.message || '加载历史记录失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadHistory(showLoading = true) {
    if (showLoading) {
      this.setData({ loading: true, error: '' });
    }

    try {
      const data = await getRecordHistory(this.data.activeRange);
      const records = (data.records || []).map((record) => ({
        ...record,
        timeText: formatDateTime(record.createdAt)
      }));

      this.setData({
        label: data.label || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        totalCalories: Number(data.totalCalories || 0),
        targetCalories: Number(data.targetCalories || 0),
        remainingCalories: Number(data.remainingCalories || 0),
        absRemainingCalories: Math.abs(Number(data.remainingCalories || 0)),
        records,
        isEmpty: records.length === 0
      });
    } catch (error) {
      this.setData({ error: error.message || '加载历史记录失败' });
    } finally {
      if (showLoading) {
        this.setData({ loading: false });
      }
    }
  },

  async loadTrend() {
    const trend = await getRecordTrend(7);

    this.setData({
      trendItems: trend.items || [],
      maxCalories: Number(trend.maxCalories || 1)
    });
  }
});

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}
