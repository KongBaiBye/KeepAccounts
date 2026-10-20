const { formatFen } = require('../../utils/money')
const { getRange, enumerateKeys } = require('../../utils/period')
const { guard } = require('../../utils/session')

const MODES = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
  { key: 'custom', label: '自定义' },
]

function deltaText(current, previous) {
  const diff = current - previous
  if (diff === 0) return '较上期 持平'
  const sign = diff > 0 ? '+' : '-'
  return `较上期 ${sign}${formatFen(Math.abs(diff))}`
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
    expenseTags: [],
    incomeTags: [],
    trend: [],
    hasActivity: false,
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 1 })
    this.bootstrap()
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
    const range = getRange(this.data.mode, this.data.shift, this.data.cycleStartDay)
    this.range = range
    this.setData({ label: range.label, rangeReady: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getSummary',
        data: {
          start: range.start.getTime(),
          end: range.end.getTime(),
          grain: range.grain,
          compare: true,
          detail: true,
        },
      })
      if (seq !== this.loadSeq) return
      const result = res.result || {}
      if (result.error) throw new Error(result.error)
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
    const trend = enumerateKeys(range.start, range.end, range.grain).map((key) => ({
      key,
      label: range.grain === 'month' ? `${Number(key.slice(5))}月` : String(Number(key.slice(8))),
      expense: trendMap[key] ? trendMap[key].expense : 0,
      income: trendMap[key] ? trendMap[key].income : 0,
    }))
    const max = trend.reduce((peak, item) => Math.max(peak, item.expense, item.income), 0)
    trend.forEach((item) => {
      item.expenseH = max ? Math.round((item.expense / max) * 100) : 0
      item.incomeH = max ? Math.round((item.income / max) * 100) : 0
    })
    const expenseTags = this.decorateTags(result.tags, 'expense')
    const incomeTags = this.decorateTags(result.tags, 'income')
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
    this.data.mode = mode
    this.data.shift = 0
    this.setData({ mode, shift: 0 })
    if (mode === 'custom' && !this.data.cycleStartDay) {
      this.range = null
      this.setData({ showDayPicker: true, rangeReady: false, loaded: true, hasActivity: false })
      return
    }
    this.load()
  },

  onShift(event) {
    if (!this.data.rangeReady) return
    const shift = this.data.shift + Number(event.currentTarget.dataset.step)
    this.data.shift = shift
    this.setData({ shift })
    this.load()
  },

  onRangeTap() {
    if (this.data.mode === 'custom') this.openPicker()
  },

  openPicker() {
    this.setData({ showDayPicker: true })
  },

  closePicker() {
    this.setData({ showDayPicker: false })
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

  openTag(event) {
    if (!this.range) return
    const { id, name, color } = event.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/tag-records/index?tagId=${id}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&mode=${this.data.mode === 'day' || this.data.mode === 'custom' ? 'month' : this.data.mode}&shift=${this.data.mode === 'custom' ? 0 : this.data.shift}`,
    })
  },
})
