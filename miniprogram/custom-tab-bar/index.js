Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/assets/tabbar/home.svg',
        selectedIconPath: '/assets/tabbar/home-active.svg'
      },
      {
        pagePath: '/pages/records/records',
        text: '今日',
        iconPath: '/assets/tabbar/today.svg',
        selectedIconPath: '/assets/tabbar/today-active.svg'
      },
      {
        pagePath: '/pages/history/history',
        text: '历史',
        iconPath: '/assets/tabbar/history.svg',
        selectedIconPath: '/assets/tabbar/history-active.svg'
      },
      {
        pagePath: '/pages/settings/settings',
        text: '设置',
        iconPath: '/assets/tabbar/settings.svg',
        selectedIconPath: '/assets/tabbar/settings-active.svg'
      }
    ]
  },

  methods: {
    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      const selected = Number(index);

      if (selected === this.data.selected) return;

      wx.switchTab({
        url: path,
        fail() {
          wx.showToast({
            title: '页面打开失败',
            icon: 'none'
          });
        }
      });
      this.setData({ selected });
    }
  }
});
