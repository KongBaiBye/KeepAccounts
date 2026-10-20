function pad(number) {
  return String(number).padStart(2, '0')
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonth(year, monthIndex, delta) {
  const next = new Date(year, monthIndex + delta, 1)
  return { y: next.getFullYear(), m: next.getMonth() }
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function cycleStart(year, monthIndex, startDay) {
  const day = Math.min(startDay, daysInMonth(year, monthIndex))
  return new Date(year, monthIndex, day)
}

function startOfWeek(date) {
  const day = startOfDay(date)
  const weekday = day.getDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  return addDays(day, delta)
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function formatMonthDay(date, withYear) {
  const text = `${date.getMonth() + 1}月${date.getDate()}日`
  return withYear ? `${date.getFullYear()}年${text}` : text
}

function formatRangeLabel(mode, start, end) {
  if (mode === 'day') {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`
  }
  if (mode === 'month') {
    return `${start.getFullYear()}年${start.getMonth() + 1}月`
  }
  if (mode === 'year') {
    return `${start.getFullYear()}年`
  }
  const last = addDays(end, -1)
  const crossYear = start.getFullYear() !== last.getFullYear()
  return `${formatMonthDay(start, crossYear)} – ${formatMonthDay(last, crossYear)}`
}

function customRange(today, endDay, shift) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const thisEnd = cycleStart(year, month, endDay)
  let endDayDate = today.getTime() <= thisEnd.getTime()
    ? thisEnd
    : cycleStart(addMonth(year, month, 1).y, addMonth(year, month, 1).m, endDay)
  if (shift) {
    const moved = addMonth(endDayDate.getFullYear(), endDayDate.getMonth(), shift)
    endDayDate = cycleStart(moved.y, moved.m, endDay)
  }
  const prev = addMonth(endDayDate.getFullYear(), endDayDate.getMonth(), -1)
  const start = addDays(cycleStart(prev.y, prev.m, endDay), 1)
  const end = addDays(endDayDate, 1)
  return { start, end }
}

function getRange(mode, shift, cycleStartDay, now = new Date()) {
  const today = startOfDay(now)
  let start
  let end
  let grain = 'day'
  if (mode === 'day') {
    start = addDays(today, shift)
    end = addDays(start, 1)
  } else if (mode === 'week') {
    start = addDays(startOfWeek(today), shift * 7)
    end = addDays(start, 7)
  } else if (mode === 'month') {
    start = new Date(today.getFullYear(), today.getMonth() + shift, 1)
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  } else if (mode === 'year') {
    start = new Date(today.getFullYear() + shift, 0, 1)
    end = new Date(start.getFullYear() + 1, 0, 1)
    grain = 'month'
  } else {
    const custom = customRange(today, cycleStartDay, shift)
    start = custom.start
    end = custom.end
  }
  return {
    start,
    end,
    grain,
    label: formatRangeLabel(mode, start, end),
  }
}

function enumerateKeys(start, end, grain) {
  const keys = []
  if (grain === 'month') {
    let year = start.getFullYear()
    let month = start.getMonth()
    while (new Date(year, month, 1) < end) {
      keys.push(`${year}-${pad(month + 1)}`)
      const next = addMonth(year, month, 1)
      year = next.y
      month = next.m
    }
    return keys
  }
  for (let cursor = startOfDay(start); cursor < end; cursor = addDays(cursor, 1)) {
    keys.push(dayKey(cursor))
  }
  return keys
}

module.exports = {
  startOfDay,
  addDays,
  dayKey,
  monthKey,
  getRange,
  enumerateKeys,
}
