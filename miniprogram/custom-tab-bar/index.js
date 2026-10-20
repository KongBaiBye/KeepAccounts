Component({
  data: {
    hidden: false,
    selected: 0,
    list: [
      { pagePath: '/pages/bill/index', text: '账单', icon: '/images/tab-bill.svg' },
      { pagePath: '/pages/report/index', text: '报表', icon: '/images/tab-report.svg' },
      { pagePath: '/pages/mine/index', text: '我的', icon: '/images/tab-mine.svg' },
    ],
  },
  methods: {
    onSwitch(event) {
      const index = Number(event.currentTarget.dataset.index)
      const url = this.data.list[index].pagePath
      this.setData({ selected: index })
      wx.switchTab({ url })
    },
  },
})
