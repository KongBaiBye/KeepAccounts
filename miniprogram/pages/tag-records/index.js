const { getRange, addDays, startOfDay } = require('../../utils/period')
const { formatDateInput } = require('../../utils/time')
const { guard } = require('../../utils/session')
const { groupRecords } = require('../../utils/records')
const { queryRecords, getAllTags } = require('../../utils/query')
const { formatFen } = require('../../utils/money')
const { branchIds, hasChildren, tagRows } = require('../../utils/tags')

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
    childTags: [],
  },

  onLoad(options) {
    this.tagId = options.tagId || ''
    this.scope = options.scope === 'branch' ? 'branch' : 'tag'
    const name = decodeURIComponent(options.name || '流水')
    const mode = MODES.some((item) => item.key === options.mode) ? options.mode : 'month'
    wx.setNavigationBarTitle({ title: name })
    this.setData({
      name,
      color: decodeURIComponent(options.color || '#B0A4C8'),
      mode,
      shift: mode === 'custom' ? 0 : (Number(options.shift) || 0),
      customStart: options.customStart || '',
      customEnd: options.customEnd || '',
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
        childTags: [],
      })
      return
    }
    const range = this.currentRange()
    this.range = range
    this.tagsPromise = null
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
      await this.ensureTags()
      const data = {
        start: range.start.getTime(),
        end: range.end.getTime(),
        grain: 'day',
        compare: false,
        detail: this.scope === 'branch',
        group: 'child',
      }
      if (this.scope !== 'branch') data.tagId = this.tagId
      const res = await wx.cloud.callFunction({ name: 'getSummary', data })
      if (seq !== this.loadSeq) return
      const result = res.result || {}
      if (result.error) throw new Error(result.error)
      let expense = Math.round(Number(result.expense) || 0)
      let income = Math.round(Number(result.income) || 0)
      let childTags = []
      if (this.scope === 'branch') {
        const ids = new Set(this.recordIds())
        const leaf = (result.tags || []).filter((item) => ids.has(item.tagId))
        expense = 0
        income = 0
        leaf.forEach((item) => {
          const amount = Math.round(Number(item.amount) || 0)
          if (item.type === 'income') income += amount
          else expense += amount
        })
        if (hasChildren(this.tags || [], this.tagId)) {
          childTags = this.decorateTags(tagRows(leaf, this.tags, {
            group: 'child',
            focusId: this.tagId,
          }))
        }
      }
      const balance = income - expense
      this.setData({
        totalText: balance > 0 ? `+${formatFen(balance)}` : formatFen(balance),
        totalTone: balance > 0 ? 'income' : balance < 0 ? 'expense' : '',
        childTags,
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

  ensureTags() {
    if (!this.tagsPromise) {
      this.tagsPromise = getAllTags().then((tags) => {
        this.tags = tags
        return tags
      }).catch((err) => {
        console.error(err)
        this.tagsPromise = null
        this.tags = this.tags || []
        return this.tags
      })
    }
    return this.tagsPromise
  },

  recordIds() {
    if (this.scope !== 'branch') return [this.tagId]
    return branchIds(this.tagId, this.tags || [])
  },

  decorateTags(tags) {
    const list = tags.filter((item) => item.amount > 0)
    const total = list.reduce((sum, item) => sum + item.amount, 0)
    return list.map((item) => ({
      ...item,
      amountText: formatFen(item.amount),
      width: total ? Math.max(8, Math.round((item.amount / total) * 100)) : 0,
    }))
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
      await this.ensureTags()
      const ids = this.recordIds()
      const res = await queryRecords({
        where: {
          tagId: ids.length === 1 ? ids[0] : _.in(ids),
          occurredAt: _.gte(this.range.start).and(_.lt(this.range.end)),
        },
        looseWhere: ids.length === 1 ? { tagId: ids[0] } : {},
        test: (record) => {
          const time = new Date(record.occurredAt).getTime()
          return ids.includes(record.tagId) && time >= start && time < end
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
        groups: groupRecords(records, this.tags),
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
          childTags: [],
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

  openChild(event) {
    const { id, name, color } = event.currentTarget.dataset
    if (!id || !this.range) return
    const mode = this.data.mode
    const shift = mode === 'custom' ? 0 : this.data.shift
    const range = mode === 'custom' ? `&customStart=${this.data.customStart}&customEnd=${this.data.customEnd}` : ''
    wx.navigateTo({
      url: `/pages/tag-records/index?tagId=${id}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&mode=${mode}&shift=${shift}&scope=tag${range}`,
    })
  },
})
