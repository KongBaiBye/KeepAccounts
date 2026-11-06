const { guard } = require('../../utils/session')
const {
  toSeconds,
  validateRest,
  computeEarn,
  formatYuan,
  formatDuration,
} = require('../../utils/earn')

const STATUS_LABEL = {
  before: '还没上班',
  working: '工作中',
  resting: '休息中',
  after: '已下班',
  empty: '待配置',
}

const STATUS_HINT = {
  before: '上班后会按秒累加',
  working: '正在按秒累计今天的工资',
  resting: '休息时段不计薪，金额先停在这里',
  after: '今天的班已经上完了',
  empty: '先填好工作信息',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(number) {
  return String(number).padStart(2, '0')
}

function buildDateLabel(now = new Date()) {
  return `${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]}`
}

function splitDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  return {
    remainH: pad(Math.floor(s / 3600)),
    remainM: pad(Math.floor((s % 3600) / 60)),
    remainS: pad(s % 60),
  }
}

Page({
  data: {
    ready: false,
    configured: false,
    editing: false,
    salary: '',
    workDays: '21.75',
    startTime: '09:00',
    endTime: '18:00',
    hasRest: true,
    restStartTime: '12:00',
    restEndTime: '13:00',
    showRest: false,
    dateLabel: '',
    earnedText: '0.00',
    remainingText: '00:00:00',
    remainH: '00',
    remainM: '00',
    remainS: '00',
    statusLabel: '',
    statusKey: 'empty',
    statusHint: '',
    countdownLabel: '距下班',
    dailyWageText: '0.00',
    hourlyWageText: '0.00',
    progressPercent: 0,
    progressDot: 0,
    saving: false,
  },

  onShow() {
    this.bootstrap()
  },

  onHide() {
    this.stopTimer()
  },

  onUnload() {
    this.stopTimer()
  },

  async bootstrap() {
    const user = await guard()
    if (!user) return
    await this.loadConfig()
    this.setData({ ready: true })
    this.startTimer()
    this.tick()
  },

  async loadConfig() {
    try {
      const res = await wx.cloud.database().collection('settings').limit(1).get()
      const doc = res.data[0]
      if (!doc) return
      this.settingsId = doc._id
      if (doc.earnSalary) {
        const restStartTime = doc.earnRestStartTime || '12:00'
        const restEndTime = doc.earnRestEndTime || '13:00'
        const hasRest = !!(doc.earnRestStartTime && doc.earnRestEndTime
          && doc.earnRestStartTime !== doc.earnRestEndTime)
        this.setData({
          configured: true,
          editing: false,
          salary: String(doc.earnSalary),
          workDays: String(doc.earnWorkDays || ''),
          startTime: doc.earnStartTime || '09:00',
          endTime: doc.earnEndTime || '18:00',
          hasRest,
          restStartTime,
          restEndTime,
          showRest: hasRest,
        })
      }
    } catch (err) {
      console.error(err)
    }
  },

  startTimer() {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), 1000)
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  earnConfig() {
    const { salary, workDays, startTime, endTime, hasRest, restStartTime, restEndTime } = this.data
    return {
      salary,
      workDays,
      startTime,
      endTime,
      restStartTime: hasRest ? restStartTime : '',
      restEndTime: hasRest ? restEndTime : '',
    }
  },

  tick() {
    const now = new Date()
    const result = computeEarn(this.earnConfig(), now)
    const dateLabel = buildDateLabel(now)
    if (!result.valid) {
      this.setData({
        dateLabel,
        earnedText: '0.00',
        remainingText: '00:00:00',
        remainH: '00',
        remainM: '00',
        remainS: '00',
        statusLabel: STATUS_LABEL.empty,
        statusKey: 'empty',
        statusHint: STATUS_HINT.empty,
        countdownLabel: '距下班',
        dailyWageText: '0.00',
        hourlyWageText: '0.00',
        progressPercent: 0,
        progressDot: 0,
      })
      return
    }
    const parts = splitDuration(result.remaining)
    const progressPercent = Math.round(result.progress * 100)
    const progressDot = Math.min(98, Math.max(2, progressPercent))
    let countdownLabel = '距下班'
    if (result.status === 'after') countdownLabel = '今日工时已结束'
    else if (result.status === 'resting') countdownLabel = '休息中 · 距下班'
    this.setData({
      dateLabel,
      earnedText: formatYuan(result.earned),
      remainingText: formatDuration(result.remaining),
      remainH: parts.remainH,
      remainM: parts.remainM,
      remainS: parts.remainS,
      statusLabel: STATUS_LABEL[result.status] || '',
      statusKey: result.status,
      statusHint: STATUS_HINT[result.status] || '',
      countdownLabel,
      dailyWageText: formatYuan(result.dailyWage),
      hourlyWageText: formatYuan(result.hourlyWage),
      progressPercent,
      progressDot: progressPercent === 0 ? 0 : progressPercent === 100 ? 100 : progressDot,
      showRest: !!result.hasRest,
    })
  },

  editConfig() {
    this.setData({ configured: false, editing: true })
  },

  cancelEdit() {
    this.setData({ configured: true, editing: false })
    this.tick()
  },

  onSalary(event) {
    this.setData({ salary: event.detail.value })
  },

  onWorkDays(event) {
    this.setData({ workDays: event.detail.value })
  },

  onStartTime(event) {
    this.setData({ startTime: event.detail.value })
  },

  onEndTime(event) {
    this.setData({ endTime: event.detail.value })
  },

  onHasRest(event) {
    this.setData({ hasRest: !!event.detail.value })
  },

  onRestStartTime(event) {
    this.setData({ restStartTime: event.detail.value })
  },

  onRestEndTime(event) {
    this.setData({ restEndTime: event.detail.value })
  },

  async onSave() {
    if (this.data.saving) return
    const salary = Number(this.data.salary)
    const workDays = Number(this.data.workDays)
    const startTime = this.data.startTime
    const endTime = this.data.endTime
    const hasRest = !!this.data.hasRest
    const restStartTime = this.data.restStartTime
    const restEndTime = this.data.restEndTime
    if (!(salary > 0)) {
      wx.showToast({ title: '请填写月工资', icon: 'none' })
      return
    }
    if (!(workDays > 0 && workDays <= 31)) {
      wx.showToast({ title: '工作天数需在 0–31 之间', icon: 'none' })
      return
    }
    if (toSeconds(startTime) === toSeconds(endTime)) {
      wx.showToast({ title: '上下班时间不能相同', icon: 'none' })
      return
    }
    if (hasRest) {
      if (restStartTime === restEndTime) {
        wx.showToast({ title: '休息起止不能相同', icon: 'none' })
        return
      }
      const restError = validateRest({
        startTime,
        endTime,
        restStartTime,
        restEndTime,
      })
      if (restError) {
        wx.showToast({ title: restError, icon: 'none' })
        return
      }
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const db = wx.cloud.database()
      const payload = {
        earnSalary: salary,
        earnWorkDays: workDays,
        earnStartTime: startTime,
        earnEndTime: endTime,
        earnRestStartTime: hasRest ? restStartTime : '',
        earnRestEndTime: hasRest ? restEndTime : '',
      }
      if (this.settingsId) {
        await db.collection('settings').doc(this.settingsId).update({ data: payload })
      } else {
        const added = await db.collection('settings').add({ data: payload })
        this.settingsId = added._id
      }
      this.setData({
        configured: true,
        editing: false,
        salary: String(salary),
        workDays: String(workDays),
        startTime,
        endTime,
        hasRest,
        restStartTime,
        restEndTime,
        showRest: hasRest,
      })
      this.tick()
      wx.showToast({ title: '已保存', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '没有保存成功', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  },
})
