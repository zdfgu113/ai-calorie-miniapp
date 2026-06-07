const { getTodayRecords, updateRecord, deleteRecord } = require('../../utils/request');

Page({
  data: {
    date: '',
    dailyGoalCalories: 1800,
    totalCalories: 0,
    remainingCalories: 1800,
    absRemainingCalories: 1800,
    progressPercent: 0,
    records: [],
    isEmpty: true,
    loading: false,
    error: '',
    editing: false,
    editForm: null,
    editingId: '',
    savingEdit: false,
    deletingId: ''
  },

  onShow() {
    this.syncTabBar();
    this.loadTodayRecords();
  },

  syncTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  async loadTodayRecords() {
    this.setData({ loading: true, error: '' });

    try {
      const data = await getTodayRecords();
      const dailyGoalCalories = Number(data.dailyGoalCalories || 1800);
      const totalCalories = Number(data.totalCalories || 0);
      const records = (data.records || []).map((record) => ({
        ...record,
        timeText: formatTime(record.createdAt)
      }));
      const progressPercent = dailyGoalCalories > 0
        ? Math.min(100, Math.round((totalCalories / dailyGoalCalories) * 100))
        : 0;

      this.setData({
        date: data.date || '',
        dailyGoalCalories,
        totalCalories,
        remainingCalories: Number(data.remainingCalories || 0),
        absRemainingCalories: Math.abs(Number(data.remainingCalories || 0)),
        progressPercent,
        records,
        isEmpty: records.length === 0
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载今日记录失败'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  openEdit(event) {
    const id = event.currentTarget.dataset.id;
    const record = this.data.records.find((item) => item.id === id);

    if (!record) return;

    this.setData({
      editing: true,
      editingId: id,
      editForm: {
        foodName: record.foodName,
        estimatedWeight: record.estimatedWeight,
        calories: String(record.calories),
        protein: String(record.protein),
        fat: String(record.fat),
        carbs: String(record.carbs),
        dietAdvice: record.dietAdvice || ''
      },
      error: ''
    });
  },

  closeEdit() {
    if (this.data.savingEdit) return;

    this.setData({
      editing: false,
      editingId: '',
      editForm: null
    });
  },

  noop() {},

  handleEditInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;

    this.setData({
      [`editForm.${field}`]: value
    });
  },

  async saveEdit() {
    if (this.data.savingEdit || !this.data.editingId || !this.data.editForm) return;

    const payload = normalizeEditForm(this.data.editForm);
    const validationMessage = validateEditForm(payload);

    if (validationMessage) {
      this.setData({ error: validationMessage });
      return;
    }

    this.setData({ savingEdit: true, error: '' });

    try {
      await updateRecord(this.data.editingId, payload);
      getApp().globalData.recordsChangedAt = Date.now();
      this.setData({
        editing: false,
        editingId: '',
        editForm: null
      });
      await this.loadTodayRecords();
      wx.showToast({
        title: '已更新',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ error: error.message || '更新记录失败' });
    } finally {
      this.setData({ savingEdit: false });
    }
  },

  confirmDelete(event) {
    const id = event.currentTarget.dataset.id;
    const record = this.data.records.find((item) => item.id === id);

    if (!record || this.data.deletingId) return;

    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.foodName}」吗？`,
      confirmText: '删除',
      confirmColor: '#b43b25',
      success: async (res) => {
        if (!res.confirm) return;
        await this.removeRecord(id);
      }
    });
  },

  async removeRecord(id) {
    this.setData({ deletingId: id, error: '' });

    try {
      await deleteRecord(id);
      getApp().globalData.recordsChangedAt = Date.now();
      await this.loadTodayRecords();
      wx.showToast({
        title: '已删除',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ error: error.message || '删除记录失败' });
    } finally {
      this.setData({ deletingId: '' });
    }
  }
});

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function normalizeEditForm(form) {
  return {
    foodName: String(form.foodName || '').trim(),
    estimatedWeight: String(form.estimatedWeight || '').trim(),
    calories: Number(form.calories),
    protein: Number(form.protein),
    fat: Number(form.fat),
    carbs: Number(form.carbs),
    dietAdvice: String(form.dietAdvice || '').trim()
  };
}

function validateEditForm(form) {
  if (!form.foodName) return '食物名称不能为空';
  if (!form.estimatedWeight) return '重量不能为空，例如 300g';
  if (!form.dietAdvice) return '减脂建议不能为空';

  const numericFields = [
    ['calories', '热量'],
    ['protein', '蛋白质'],
    ['fat', '脂肪'],
    ['carbs', '碳水']
  ];

  for (const [key, label] of numericFields) {
    if (!Number.isFinite(form[key]) || form[key] < 0) {
      return `${label}需要填写 0 或更大的数字`;
    }
  }

  return '';
}
