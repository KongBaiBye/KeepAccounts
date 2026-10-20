const { dayKey } = require('./period')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function toDate(value) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (value.$date) return new Date(value.$date)
  return new Date(value)
}

function pad(number) {
  return String(number).padStart(2, '0')
}

function formatDateInput(date) {
  const value = toDate(date)
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function parseDateInput(text) {
  return parseDateTime(text, '12:00')
}

function parseDateTime(dateText, timeText) {
  const [year, month, day] = String(dateText).split('-').map(Number)
  const [hour, minute] = String(timeText || '12:00').split(':').map(Number)
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0)
}

function isSameDay(left, right) {
  const a = toDate(left)
  const b = toDate(right)
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatDayLabel(date) {
  const value = toDate(date)
  return `${value.getMonth() + 1}月${value.getDate()}日 周${WEEKDAYS[value.getDay()]}`
}

function formatShortDay(date) {
  const value = toDate(date)
  if (isSameDay(value, new Date())) return '今天'
  return `${value.getMonth() + 1}月${value.getDate()}日`
}

module.exports = {
  WEEKDAYS,
  toDate,
  dayKey,
  formatDateInput,
  parseDateInput,
  parseDateTime,
  isSameDay,
  formatDayLabel,
  formatShortDay,
}
