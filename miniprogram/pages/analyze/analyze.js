const { uploadFoodImage, saveRecord } = require('../../utils/request');
const { compressImage } = require('../../utils/image');

const SLIDE_OPEN_OFFSET = -88;

Page({
  data: {
    imagePath: '',
    result: null,
    loading: false,
    saving: false,
    saved: false,
    error: '',
    proteinPercent: 0,
    fatPercent: 0,
    carbsPercent: 0,
    resultOffset: 0,
    editing: false,
    editForm: null
  },

  onLoad(options) {
    const imagePath = options.imagePath ? decodeURIComponent(options.imagePath) : '';

    if (!imagePath) {
      this.setData({ error: '没有拿到图片，请回首页重新选择。' });
      return;
    }

    this.setData({ imagePath });
    this.analyzeImage(imagePath);
  },

  async analyzeImage(filePath) {
    this.setData({
      loading: true,
      error: '',
      result: null,
      saved: false,
      resultOffset: 0
    });

    try {
      const result = await uploadFoodImage(filePath);
      this.setData({
        result,
        ...buildMacroPercents(result)
      });
    } catch (error) {
      this.setData({
        error: formatAnalyzeError(error.message)
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  chooseAgain() {
    if (this.data.loading) return;

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

        this.setData({
          loading: true,
          error: '',
          result: null,
          saved: false
        });

        try {
          const compressed = await compressImage(file.tempFilePath, { quality: 70 });
          this.setData({ imagePath: compressed.filePath });
          this.analyzeImage(compressed.filePath);
        } catch (error) {
          this.setData({
            loading: false,
            error: error.message || '处理图片失败，请重新选择'
          });
        }
      },
      fail: (error) => {
        if (error.errMsg && error.errMsg.includes('cancel')) return;
        this.setData({ error: '选择图片失败，请重试' });
      }
    });
  },

  handleResultTouchStart(event) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartOffset = this.data.resultOffset;
  },

  handleResultTouchMove(event) {
    const deltaX = event.touches[0].clientX - this.touchStartX;
    const nextOffset = Math.max(SLIDE_OPEN_OFFSET, Math.min(0, this.touchStartOffset + deltaX));

    this.setData({
      resultOffset: nextOffset
    });
  },

  handleResultTouchEnd() {
    this.setData({
      resultOffset: this.data.resultOffset < SLIDE_OPEN_OFFSET / 2 ? SLIDE_OPEN_OFFSET : 0
    });
  },

  openEdit() {
    if (!this.data.result) return;

    if (this.data.saved) {
      wx.showToast({
        title: '请到今日页编辑',
        icon: 'none'
      });
      this.setData({ resultOffset: 0 });
      return;
    }

    this.setData({
      resultOffset: 0,
      editing: true,
      editForm: {
        foodName: this.data.result.foodName,
        estimatedWeight: this.data.result.estimatedWeight,
        calories: String(this.data.result.calories),
        protein: String(this.data.result.protein),
        fat: String(this.data.result.fat),
        carbs: String(this.data.result.carbs),
        dietAdvice: this.data.result.dietAdvice || ''
      },
      error: ''
    });
  },

  closeEdit() {
    this.setData({
      editing: false,
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

  saveEditResult() {
    if (!this.data.editForm) return;

    const result = normalizeEditForm(this.data.editForm);
    const validationMessage = validateEditForm(result);

    if (validationMessage) {
      this.setData({ error: validationMessage });
      return;
    }

    this.setData({
      result,
      editing: false,
      editForm: null,
      saved: false,
      ...buildMacroPercents(result)
    });

    wx.showToast({
      title: '已应用',
      icon: 'success'
    });
  },

  async handleSaveRecord() {
    if (!this.data.result || this.data.saved || this.data.saving) return;

    this.setData({ saving: true, error: '' });

    try {
      await saveRecord(this.data.result);
      getApp().globalData.recordsChangedAt = Date.now();
      this.setData({ saved: true });
      wx.showToast({
        title: '已保存',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ error: error.message || '保存失败，请重试' });
    } finally {
      this.setData({ saving: false });
    }
  }
});

function buildMacroPercents(result) {
  const protein = Number(result.protein || 0);
  const fat = Number(result.fat || 0);
  const carbs = Number(result.carbs || 0);
  const total = Math.max(protein + fat + carbs, 1);

  return {
    proteinPercent: Math.max(6, Math.round((protein / total) * 100)),
    fatPercent: Math.max(6, Math.round((fat / total) * 100)),
    carbsPercent: Math.max(6, Math.round((carbs / total) * 100))
  };
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

function formatAnalyzeError(message) {
  const text = message || '';

  if (text.includes('无法识别') || text.includes('无法判断') || text.includes('不是食物')) {
    return '这张图没看清食物。请尽量让食物占满画面，光线亮一点，再拍一次。';
  }

  if (text.includes('JSON') || text.includes('格式')) {
    return '模型这次回答格式不稳定。请重新拍一张更清晰的食物图再试。';
  }

  if (text.includes('超时')) {
    return '识别时间有点久。请稍后重试，或换一张更小、更清晰的图片。';
  }

  if (text.includes('过大')) {
    return '图片太大了。请换一张较小的图片，或在相册里裁剪后再上传。';
  }

  if (text.includes('API') || text.includes('模型') || text.includes('Provider')) {
    return text;
  }

  return text || '识别失败。请换一张光线更好、食物更清楚的照片再试。';
}
