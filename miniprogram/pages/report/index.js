const { formatFen } = require('../../utils/money')
const { getRange, enumerateKeys, dateSpan, addDays } = require('../../utils/period')
const { formatDateInput } = require('../../utils/time')
const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')
const { recordTitle, tagRows } = require('../../utils/tags')

const MODES = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
  { key: 'custom', label: '自定义' },
  { key: 'time', label: '时间' },
]

function deltaText(current, previous) {
  const diff = current - previous
  if (diff === 0) return '较上期 持平'
  const sign = diff > 0 ? '+' : '-'
  return `较上期 ${sign}${formatFen(Math.abs(diff))}`
}

function trendLabel(key, grain, timeMode, crossYear, crossMonth) {
  if (grain === 'month') {
    const month = `${Number(key.slice(5))}月`
    return timeMode && crossYear ? `${key.slice(0, 4)}年${month}` : month
  }
  const day = String(Number(key.slice(8)))
  return timeMode && crossMonth ? `${Number(key.slice(5))}/${day}` : day
}

function deltaTone(kind, diff) {
  if (diff === 0) return 'flat'
  if (kind === 'expense') return diff > 0 ? 'down' : 'up'
  return diff > 0 ? 'up' : 'down'
}

Page({
  data: {
    ready: false,
    loaded: false,
    modes: MODES,
    mode: 'month',
    shift: 0,
    cycleStartDay: 0,
    days: Array.from({ length: 31 }, (_, index) => index + 1),
    showDayPicker: false,
    timeStart: '',
    timeEnd: '',
    draftStart: '',
    draftEnd: '',
    showRangePicker: false,
    rangeReady: true,
    label: '',
    expenseText: '0.00',
    incomeText: '0.00',
    balanceText: '0.00',
    expenseDeltaText: '',
    incomeDeltaText: '',
    balanceDeltaText: '',
    expenseTone: 'flat',
    incomeTone: 'flat',
    balanceTone: 'flat',
    tagGroup: 'parent',
    expenseTags: [],
    incomeTags: [],
    trend: [],
    hasActivity: false,
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) {
      tabBar.setData({
        selected: 1,
        hidden: this.data.showDayPicker || this.data.showRangePicker,
      })
    }
    this.bootstrap()
  },

  onHide() {
    this.setTabBarHidden(false)
  },

  setTabBarHidden(hidden) {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) tabBar.setData({ hidden })
  },

  async onPullDownRefresh() {
    await this.bootstrap()
    wx.stopPullDownRefresh()
  },

  async bootstrap() {
    const user = await guard()
    if (!user) return
    await this.loadSettings()
    this.setData({ ready: true })
    this.load()
  },

  async loadSettings() {
    try {
      const res = await wx.cloud.database().collection('settings').limit(1).get()
      const doc = res.data[0]
      if (!doc) return
      this.settingsId = doc._id
      if (!this.data.cycleStartDay && doc.cycleStartDay) {
        this.setData({ cycleStartDay: doc.cycleStartDay })
      }
    } catch (err) {
      console.error(err)
    }
  },

  async load() {
    const seq = (this.loadSeq || 0) + 1
    this.loadSeq = seq
    if (this.data.mode === 'custom' && !this.data.cycleStartDay) {
      this.range = null
      this.setData({ loaded: true, rangeReady: false, hasActivity: false })
      return
    }
    if (this.data.mode === 'time' && !this.data.timeStart) {
      this.range = null
      this.setData({ loaded: true, rangeReady: false, hasActivity: false })
      return
    }
    const range = this.data.mode === 'time'
      ? dateSpan(this.data.timeStart, this.data.timeEnd)
      : getRange(this.data.mode, this.data.shift, this.data.cycleStartDay)
    this.range = range
    this.setData({ label: range.label, rangeReady: true })
    try {
      const [res, tags] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getSummary',
          data: {
            start: range.start.getTime(),
            end: range.end.getTime(),
            grain: range.grain,
            compare: true,
            detail: true,
            group: 'child',
          },
        }),
        getAllTags().catch((err) => {
          console.error(err)
          return []
        }),
      ])
      if (seq !== this.loadSeq) return
      const result = res.result || {}
      if (result.error) throw new Error(result.error)
      this.tags = tags
      this.applySummary(range, result)
    } catch (err) {
      console.error(err)
      if (seq === this.loadSeq) wx.showToast({ title: '报表暂时没有拿到', icon: 'none' })
    }
  },

  applySummary(range, result) {
    const trendMap = {}
    ;(result.trend || []).forEach((item) => {
      trendMap[item.key] = item
    })
    const last = addDays(range.end, -1)
    const crossYear = range.start.getFullYear() !== last.getFullYear()
    const crossMonth = crossYear || range.start.getMonth() !== last.getMonth()
    const timeMode = this.data.mode === 'time'
    const trend = enumerateKeys(range.start, range.end, range.grain).map((key) => ({
      key,
      label: trendLabel(key, range.grain, timeMode, crossYear, crossMonth),
      expense: trendMap[key] ? trendMap[key].expense : 0,
      income: trendMap[key] ? trendMap[key].income : 0,
    }))
    const max = trend.reduce((peak, item) => Math.max(peak, item.expense, item.income), 0)
    const barMax = 168
    trend.forEach((item) => {
      item.expenseH = max && item.expense ? Math.max(6, Math.round((item.expense / max) * barMax)) : 0
      item.incomeH = max && item.income ? Math.max(6, Math.round((item.income / max) * barMax)) : 0
      item.expenseText = item.expense ? formatFen(item.expense) : ''
      item.incomeText = item.income ? formatFen(item.income) : ''
    })
    const childView = this.data.tagGroup === 'child'
    const tags = this.tags || []
    const grouped = tagRows(result.tags || [], tags, {
      group: childView ? 'child' : 'parent',
    }).map((item) => ({
      ...item,
      label: childView ? recordTitle(item, tags) : item.tagName,
    }))
    const expenseTags = this.decorateTags(grouped, 'expense')
    const incomeTags = this.decorateTags(grouped, 'income')
    const expenseDiff = result.expense - result.prevExpense
    const incomeDiff = result.income - result.prevIncome
    const balanceDiff = result.balance - result.prevBalance
    this.setData({
      loaded: true,
      label: range.label,
      rangeReady: true,
      expenseText: formatFen(result.expense),
      incomeText: formatFen(result.income),
      balanceText: formatFen(result.balance),
      expenseDeltaText: deltaText(result.expense, result.prevExpense),
      incomeDeltaText: deltaText(result.income, result.prevIncome),
      balanceDeltaText: deltaText(result.balance, result.prevBalance),
      expenseTone: deltaTone('expense', expenseDiff),
      incomeTone: deltaTone('income', incomeDiff),
      balanceTone: deltaTone('balance', balanceDiff),
      expenseTags,
      incomeTags,
      trend,
      hasActivity: result.expense + result.income > 0,
    })
  },

  decorateTags(tags, type) {
    const list = (tags || []).filter((item) => item.type === type)
    const total = list.reduce((sum, item) => sum + item.amount, 0)
    return list.map((item) => ({
      ...item,
      amountText: formatFen(item.amount),
      width: total ? Math.max(8, Math.round((item.amount / total) * 100)) : 0,
    }))
  },

  onMode(event) {
    const mode = event.currentTarget.dataset.key
    if (mode === 'time') {
      this.openRangePicker()
      return
    }
    this.data.mode = mode
    this.data.shift = 0
    this.setData({ mode, shift: 0 })
    if (mode === 'custom' && !this.data.cycleStartDay) {
      this.range = null
      this.setData({ showDayPicker: true, rangeReady: false, loaded: true, hasActivity: false })
      this.setTabBarHidden(true)
      return
    }
    this.load()
  },

  onShift(event) {
    if (!this.data.rangeReady || this.data.mode === 'time') return
    const shift = this.data.shift + Number(event.currentTarget.dataset.step)
    this.data.shift = shift
    this.setData({ shift })
    this.load()
  },

  onRangeTap() {
    if (this.data.mode === 'custom') this.openPicker()
    if (this.data.mode === 'time') this.openRangePicker()
  },

  openRangePicker() {
    const today = new Date()
    const monthStart = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
    const todayText = formatDateInput(today)
    this.setData({
      showRangePicker: true,
      draftStart: this.data.timeStart || monthStart,
      draftEnd: this.data.timeEnd || todayText,
    })
    this.setTabBarHidden(true)
  },

  closeRangePicker() {
    this.setData({ showRangePicker: false })
    this.setTabBarHidden(false)
  },

  onDraftStart(event) {
    const draftStart = event.detail.value
    const draftEnd = this.data.draftEnd < draftStart ? draftStart : this.data.draftEnd
    this.setData({ draftStart, draftEnd })
  },

  onDraftEnd(event) {
    this.setData({ draftEnd: event.detail.value })
  },

  applyRange() {
    const timeStart = this.data.draftStart
    const timeEnd = this.data.draftEnd
    if (!timeStart || !timeEnd || timeEnd < timeStart) {
      wx.showToast({ title: '请选择有效区间', icon: 'none' })
      return
    }
    this.data.timeStart = timeStart
    this.data.timeEnd = timeEnd
    this.data.mode = 'time'
    this.data.shift = 0
    this.setData({
      timeStart,
      timeEnd,
      mode: 'time',
      shift: 0,
      showRangePicker: false,
    })
    this.setTabBarHidden(false)
    this.load()
  },

  openPicker() {
    this.setData({ showDayPicker: true })
    this.setTabBarHidden(true)
  },

  closePicker() {
    this.setData({ showDayPicker: false })
    this.setTabBarHidden(this.data.showRangePicker)
  },

  noop() {},

  async pickDay(event) {
    const day = Number(event.currentTarget.dataset.day)
    this.data.cycleStartDay = day
    this.data.shift = 0
    this.data.mode = 'custom'
    this.setData({
      cycleStartDay: day,
      shift: 0,
      showDayPicker: false,
      mode: 'custom',
    })
    this.setTabBarHidden(false)
    try {
      const db = wx.cloud.database()
      if (this.settingsId) {
        await db.collection('settings').doc(this.settingsId).update({
          data: { cycleStartDay: day },
        })
      } else {
        const added = await db.collection('settings').add({ data: { cycleStartDay: day } })
        this.settingsId = added._id
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '起始日没有保存', icon: 'none' })
    }
    this.load()
  },

  onTagGroup(event) {
    const tagGroup = event.currentTarget.dataset.group === 'child' ? 'child' : 'parent'
    if (tagGroup === this.data.tagGroup) return
    this.setData({ tagGroup })
    this.load()
  },

  openTag(event) {
    if (!this.range) return
    const { id, name, color } = event.currentTarget.dataset
    const scope = this.data.tagGroup === 'child' ? 'tag' : 'branch'
    if (this.data.mode === 'time') {
      wx.navigateTo({
        url: `/pages/tag-records/index?tagId=${id}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&mode=time&shift=0&scope=${scope}&timeStart=${this.data.timeStart}&timeEnd=${this.data.timeEnd}`,
      })
      return
    }
    const mode = this.data.mode === 'day' ? 'month' : this.data.mode
    const shift = this.data.mode === 'day' ? 0 : this.data.shift
    wx.navigateTo({
      url: `/pages/tag-records/index?tagId=${id}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&mode=${mode}&shift=${shift}&scope=${scope}`,
    })
  },
})
