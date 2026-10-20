const { addDays } = require('../../utils/period')
const { guard } = require('../../utils/session')
const { groupRecords } = require('../../utils/records')
const { queryRecords } = require('../../utils/query')

const PAGE_SIZE = 20

Page({
  data: {
    ready: false,
    loaded: false,
    name: '',
    color: '#B0A4C8',
    span: '',
    groups: [],
    hasMore: true,
  },

  onLoad(options) {
    this.tagId = options.tagId || ''
    this.start = Number(options.start)
    this.end = Number(options.end)
    const name = decodeURIComponent(options.name || '流水')
    const start = new Date(this.start)
    const last = addDays(new Date(this.end), -1)
    const span = `${start.getMonth() + 1}月${start.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`
    wx.setNavigationBarTitle({ title: name })
    this.setData({
      name,
      color: decodeURIComponent(options.color || '#B0A4C8'),
      span,
    })
  },

  onShow() {
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
    this.skip = 0
    await this.loadRecords(true)
  },

  async loadRecords(reset) {
    if (this.loadingList) return
    this.loadingList = true
    const db = wx.cloud.database()
    const _ = db.command
    const start = new Date(this.start)
    const end = new Date(this.end)
    try {
      const res = await queryRecords({
        where: {
          tagId: this.tagId,
          occurredAt: _.gte(start).and(_.lt(end)),
        },
        looseWhere: { tagId: this.tagId },
        test: (record) => {
          const time = new Date(record.occurredAt).getTime()
          return time >= this.start && time < this.end
        },
        skip: reset ? 0 : this.skip,
        limit: PAGE_SIZE,
      })
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
      this.setData({ loaded: true })
      wx.showToast({ title: '流水暂时没有拿到', icon: 'none' })
    } finally {
      this.loadingList = false
    }
  },

  openRecord(event) {
    wx.navigateTo({ url: `/pages/record/index?id=${event.currentTarget.dataset.id}` })
  },
})
