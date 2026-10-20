const { getRange, addDays, startOfDay } = require('../../utils/period')
const { formatDateInput } = require('../../utils/time')
const { guard } = require('../../utils/session')
const { groupRecords } = require('../../utils/records')
const { queryRecords } = require('../../utils/query')
const { formatFen } = require('../../utils/money')

const PAGE_SIZE = 20
const MODES = [
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
  { key: 'custom', label: '自定义' },
]

function dateFromText(text) {
  const [year, month, day] = String(text).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function rangeLabel(start, end) {
  const last = addDays(end, -1)
  const crossYear = start.getFullYear() !== last.getFullYear()
  const text = (date) => {
    const day = `${date.getMonth() + 1}月${date.getDate()}日`
    return crossYear ? `${date.getFullYear()}年${day}` : day
  }
  return `${text(start)} – ${text(last)}`
}

Page({
  data: {
    ready: false,
    loaded: false,
    name: '',
    color: '#B0A4C8',
    modes: MODES,
    mode: 'month',
    shift: 0,
    rangeReady: true,
    label: '',
    customStart: '',
    customEnd: '',
    draftStart: '',
    draftEnd: '',
    showRangePicker: false,
    groups: [],
    hasMore: true,
    totalText: '',
    totalTone: '',
  },

  onLoad(options) {
    this.tagId = options.tagId || ''
    const name = decodeURIComponent(options.name || '流水')
    const mode = MODES.some((item) => item.key === options.mode) ? options.mode : 'month'
    wx.setNavigationBarTitle({ title: name })
    this.setData({
      name,
      color: decodeURIComponent(options.color || '#B0A4C8'),
      mode,
      shift: mode === 'custom' ? 0 : (Number(options.shift) || 0),
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
    if (this.data.hasMore && this.data.rangeReady) this.loadRecords(false)
  },

  async bootstrap() {
    const user = await guard()
    if (!user) return
    this.setData({ ready: true })
    if (this.data.mode === 'custom' && !this.data.customStart) {
      this.openRangePicker()
      this.setData({ loaded: true, rangeReady: false, groups: [], totalText: '', totalTone: '' })
      return
    }
    await this.load()
  },

  async load() {
    const seq = (this.loadSeq || 0) + 1
    this.loadSeq = seq
    if (this.data.mode === 'custom' && !this.data.customStart) {
      this.range = null
      this.setData({
        loaded: true,
        rangeReady: false,
        groups: [],
        hasMore: false,
        totalText: '',
        totalTone: '',
      })
      return
    }
    const range = this.currentRange()
    this.range = range
    this.setData({ label: range.label, rangeReady: true, totalText: '', totalTone: '' })
    this.skip = 0
    this.records = []
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
          tagId: this.tagId,
        },
      })
      if (seq !== this.loadSeq) return
      const result = res.result || {}
      if (result.error) throw new Error(result.error)
      const balance = Math.round(Number(result.balance) || 0)
      this.setData({
        totalText: balance > 0 ? `+${formatFen(balance)}` : formatFen(balance),
        totalTone: balance > 0 ? 'income' : balance < 0 ? 'expense' : '',
      })
    } catch (err) {
      console.error(err)
      if (seq === this.loadSeq) wx.showToast({ title: '合计暂时没有拿到', icon: 'none' })
    }
  },

  currentRange() {
    if (this.data.mode === 'custom') {
      const start = startOfDay(dateFromText(this.data.customStart))
      const end = addDays(startOfDay(dateFromText(this.data.customEnd)), 1)
      return { start, end, label: rangeLabel(start, end) }
    }
    return getRange(this.data.mode, this.data.shift, 1)
  },

  async loadRecords(reset, seq) {
    if (!this.range) return
    if (!reset && this.loadingList) return
    this.loadingList = true
    const pageSeq = seq || this.loadSeq
    const db = wx.cloud.database()
    const _ = db.command
    const start = this.range.start.getTime()
    const end = this.range.end.getTime()
    try {
      const res = await queryRecords({
        where: {
          tagId: this.tagId,
          occurredAt: _.gte(this.range.start).and(_.lt(this.range.end)),
        },
        looseWhere: { tagId: this.tagId },
        test: (record) => {
          const time = new Date(record.occurredAt).getTime()
          return time >= start && time < end
        },
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
        wx.showToast({ title: '流水暂时没有拿到', icon: 'none' })
      }
    } finally {
      if (pageSeq === this.loadSeq) this.loadingList = false
    }
  },

  onMode(event) {
    const mode = event.currentTarget.dataset.key
    this.data.mode = mode
    this.data.shift = 0
    this.setData({ mode, shift: 0 })
    if (mode === 'custom') {
      this.openRangePicker()
      if (!this.data.customStart) {
        this.range = null
        this.setData({
          rangeReady: false,
          loaded: true,
          groups: [],
          hasMore: false,
          totalText: '',
          totalTone: '',
        })
      }
      return
    }
    this.load()
  },

  onShift(event) {
    if (!this.data.rangeReady || this.data.mode === 'custom') return
    const shift = this.data.shift + Number(event.currentTarget.dataset.step)
    this.data.shift = shift
    this.setData({ shift })
    this.load()
  },

  openRangePicker() {
    const today = new Date()
    const monthStart = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
    const todayText = formatDateInput(today)
    this.setData({
      showRangePicker: true,
      draftStart: this.data.customStart || monthStart,
      draftEnd: this.data.customEnd || todayText,
    })
  },

  closePicker() {
    this.setData({ showRangePicker: false })
  },

  noop() {},

  onDraftStart(event) {
    const draftStart = event.detail.value
    const draftEnd = this.data.draftEnd < draftStart ? draftStart : this.data.draftEnd
    this.setData({ draftStart, draftEnd })
  },

  onDraftEnd(event) {
    this.setData({ draftEnd: event.detail.value })
  },

  applyRange() {
    const customStart = this.data.draftStart
    const customEnd = this.data.draftEnd
    if (!customStart || !customEnd || customEnd < customStart) {
      wx.showToast({ title: '请选择有效区间', icon: 'none' })
      return
    }
    this.data.customStart = customStart
    this.data.customEnd = customEnd
    this.data.mode = 'custom'
    this.setData({
      customStart,
      customEnd,
      mode: 'custom',
      showRangePicker: false,
    })
    this.load()
  },

  openRecord(event) {
    wx.navigateTo({ url: `/pages/record/index?id=${event.currentTarget.dataset.id}` })
  },
})
