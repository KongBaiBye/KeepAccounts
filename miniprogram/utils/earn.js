const DAY_SECONDS = 86400

function pad(number) {
  return String(number).padStart(2, '0')
}

// 'HH:mm' -> 当日 0 点起的秒数
function toSeconds(timeText) {
  const [hour, minute] = String(timeText || '00:00').split(':').map(Number)
  const h = Number.isFinite(hour) ? hour : 0
  const m = Number.isFinite(minute) ? minute : 0
  return h * 3600 + m * 60
}

// 时钟秒数换算成相对上班的偏移（可跨天）
function toOffset(sec, startSec) {
  let off = sec - startSec
  if (off < 0) off += DAY_SECONDS
  return off
}

// 到某个偏移时，实际已计入的工作秒（休息段不计入）
function workedUpTo(off, restOff0, restOff1, hasRest) {
  const clamped = Math.max(0, off)
  if (!hasRest) return clamped
  if (clamped <= restOff0) return clamped
  if (clamped <= restOff1) return restOff0
  return clamped - (restOff1 - restOff0)
}

function resolveRest(startSec, shiftSeconds, restStartTime, restEndTime) {
  if (!restStartTime || !restEndTime || restStartTime === restEndTime) {
    return { hasRest: false, restSeconds: 0, restOff0: 0, restOff1: 0 }
  }
  const restOff0 = toOffset(toSeconds(restStartTime), startSec)
  const restOff1 = toOffset(toSeconds(restEndTime), startSec)
  if (!(restOff1 > restOff0 && restOff0 >= 0 && restOff1 <= shiftSeconds)) {
    return { hasRest: false, restSeconds: 0, restOff0: 0, restOff1: 0, restInvalid: true }
  }
  return {
    hasRest: true,
    restSeconds: restOff1 - restOff0,
    restOff0,
    restOff1,
  }
}

// 解析配置，返回计算所需的中间量
function parseConfig(config) {
  const salary = Number(config && config.salary) || 0
  const workDays = Number(config && config.workDays) || 0
  const startTime = config && config.startTime ? String(config.startTime) : '09:00'
  const endTime = config && config.endTime ? String(config.endTime) : '18:00'
  const restStartTime = config && config.restStartTime ? String(config.restStartTime) : ''
  const restEndTime = config && config.restEndTime ? String(config.restEndTime) : ''
  const startSec = toSeconds(startTime)
  const endSec = toSeconds(endTime)
  // 下班不晚于上班时视为跨天（夜班），班次时长跨到次日
  const shiftSeconds = endSec > startSec ? endSec - startSec : endSec + DAY_SECONDS - startSec
  const rest = resolveRest(startSec, shiftSeconds, restStartTime, restEndTime)
  const dayWorkSeconds = Math.max(0, shiftSeconds - rest.restSeconds)
  return {
    salary,
    workDays,
    startTime,
    endTime,
    restStartTime,
    restEndTime,
    startSec,
    endSec,
    shiftSeconds,
    dayWorkSeconds,
    hasRest: rest.hasRest,
    restSeconds: rest.restSeconds,
    restOff0: rest.restOff0,
    restOff1: rest.restOff1,
    restInvalid: !!rest.restInvalid,
  }
}

// 校验休息时间是否落在班次内；无休息时返回空串
function validateRest(config) {
  const { startTime, endTime, restStartTime, restEndTime, shiftSeconds, startSec } = parseConfig({
    salary: 1,
    workDays: 1,
    startTime: config && config.startTime,
    endTime: config && config.endTime,
    restStartTime: config && config.restStartTime,
    restEndTime: config && config.restEndTime,
  })
  if (!restStartTime || !restEndTime || restStartTime === restEndTime) return ''
  if (toSeconds(startTime) === toSeconds(endTime)) return '上下班时间不能相同'
  const rest = resolveRest(startSec, shiftSeconds, restStartTime, restEndTime)
  if (rest.restInvalid || !rest.hasRest) return '休息时间需落在上班到下班之间'
  if (shiftSeconds - rest.restSeconds <= 0) return '休息后没有剩余工时'
  return ''
}

// 按秒计算：今天已赚多少、离下班还有多久（休息时段不计薪）
function computeEarn(config, now = new Date()) {
  const parsed = parseConfig(config)
  const {
    salary,
    workDays,
    startSec,
    endSec,
    shiftSeconds,
    dayWorkSeconds,
    hasRest,
    restOff0,
    restOff1,
  } = parsed
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  if (!(salary > 0) || !(workDays > 0) || dayWorkSeconds <= 0) {
    return {
      valid: false,
      earned: 0,
      remaining: 0,
      status: 'empty',
      dailyWage: 0,
      hourlyWage: 0,
      progress: 0,
      hasRest: false,
    }
  }
  const dailyWage = salary / workDays
  const perSecond = dailyWage / dayWorkSeconds
  const hourlyWage = dailyWage * 3600 / dayWorkSeconds
  const endOfShiftClock = startSec + shiftSeconds

  let off = null
  let status
  if (nowSec < endSec && endSec <= startSec) {
    // 夜班：此刻仍处在昨天班次延续到今天的凌晨
    off = nowSec + DAY_SECONDS - startSec
    status = 'working'
  } else if (nowSec < startSec) {
    off = null
    status = 'before'
  } else if (nowSec >= endOfShiftClock || (endSec > startSec && nowSec >= endSec)) {
    off = shiftSeconds
    status = 'after'
  } else {
    off = nowSec - startSec
    status = 'working'
  }

  if (status === 'working' && hasRest && off >= restOff0 && off < restOff1) {
    status = 'resting'
  }

  let earned
  let remaining
  if (status === 'before') {
    earned = 0
    remaining = endOfShiftClock - nowSec
  } else if (status === 'after') {
    earned = dailyWage
    remaining = 0
  } else {
    const worked = workedUpTo(off, restOff0, restOff1, hasRest)
    earned = perSecond * Math.min(worked, dayWorkSeconds)
    remaining = endOfShiftClock - (startSec + off)
    if (remaining < 0) remaining = 0
  }

  const progress = status === 'before' ? 0 : status === 'after' ? 1 : earned / dailyWage
  return {
    valid: true,
    earned,
    remaining,
    status,
    dailyWage,
    hourlyWage,
    progress,
    hasRest,
  }
}

// 元，两位小数 + 千分位（仅非负展示用）
function formatYuan(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100
  const [integer, decimal] = rounded.toFixed(2).split('.')
  const withComma = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${withComma}.${decimal}`
}

// 秒 -> H:MM:SS（小时不折叠，可超过 24）
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

module.exports = {
  toSeconds,
  parseConfig,
  validateRest,
  computeEarn,
  formatYuan,
  formatDuration,
}
