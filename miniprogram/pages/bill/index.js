const { formatFen } = require('../../utils/money')
const { getRange } = require('../../utils/period')
const { guard } = require('../../utils/session')
const { groupRecords } = require('../../utils/records')
const { queryRecords } = require('../../utils/query')

const PAGE_SIZE = 20

Page({
  data: {
    ready: false,
    loaded: false,
    monthLabel: '',
    expenseText: '0.00',
    incomeText: '0.00',
    balanceText: '0.00',
    groups: [],
    hasMore: true,
    sheetOpen: false,
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 0 })
    this.bootstrap()
  },

  async onPullDownRefresh() {
    await this.bootstrap()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.hasMore) this.loadRecords(false)
  },

  async bootstrap() {
    const user = await guard()
    if (!user) return
    this.setData({ ready: true })
    await this.load()
  },

  async load() {
    const seq = (this.loadSeq || 0) + 1
    this.loadSeq = seq
    this.skip = 0
    const range = getRange('month', 0)
    this.setData({ monthLabel: range.label })
    await Promise.all([
      this.loadSummary(range, seq),
      this.loadRecords(true, seq),
    ])
  },

  async loadSummary(range, seq) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getSummary',
        data: {
          start: range.start.getTime(),
          end: range.end.getTime(),
          grain: 'day',
          compare: false,
          detail: false,
        },
      })
      if (seq !== this.loadSeq) return
      const result = res.result || {}
      if (result.error) throw new Error(result.error)
      this.setData({
        expenseText: formatFen(result.expense),
        incomeText: formatFen(result.income),
        balanceText: formatFen(result.balance),
      })
    } catch (err) {
      console.error(err)
      if (seq === this.loadSeq) {
        wx.showToast({ title: '本月合计暂时没有拿到', icon: 'none' })
      }
    }
  },

  async loadRecords(reset, seq) {
    if (!reset && this.loadingList) return
    this.loadingList = true
    const pageSeq = seq || this.loadSeq
    try {
      const res = await queryRecords({
        skip: reset ? 0 : this.skip,
        limit: PAGE_SIZE,
      })
      if (pageSeq !== this.loadSeq) return
      const incoming = res.data || []
      const records = reset ? incoming : (this.records || []).concat(incoming)
      this.records = records
      this.skip = records.length
      this.setData({
        groups: groupRecords(records),
        hasMore: incoming.length === PAGE_SIZE,
        loaded: true,
      })
    } catch (err) {
      console.error(err)
      if (pageSeq === this.loadSeq) {
        this.setData({ loaded: true })
        wx.showToast({ title: '账单暂时没有拿到', icon: 'none' })
      }
    } finally {
      if (pageSeq === this.loadSeq) this.loadingList = false
    }
  },

  create() {
    this.setData({ sheetOpen: true })
  },

  closeSheet() {
    this.setData({ sheetOpen: false })
  },

  onRecordSaved() {
    this.setData({ sheetOpen: false })
    this.load()
  },

  openRecord(event) {
    wx.navigateTo({ url: `/pages/record/index?id=${event.currentTarget.dataset.id}` })
  },
})
