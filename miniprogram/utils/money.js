const MAX_INT = 10

function applyKey(raw, key) {
  const current = raw || ''
  if (key === 'del') return current.slice(0, -1)
  if (key === '.') {
    if (current.includes('.')) return current
    return `${current || '0'}.`
  }
  if (!/^\d$/.test(key)) return current
  if (!current.includes('.')) {
    if (current === '0') return key === '0' ? '0' : key
    if (current.length >= MAX_INT) return current
    return current + key
  }
  const decimal = current.split('.')[1] || ''
  if (decimal.length >= 2) return current
  return current + key
}

function rawToFen(raw) {
  if (!raw || raw === '.') return 0
  const [integer, decimal = ''] = String(raw).split('.')
  const cents = `${decimal}00`.slice(0, 2)
  const fen = Number(integer || '0') * 100 + Number(cents)
  return Number.isFinite(fen) ? fen : 0
}

function fenToRaw(fen) {
  const value = Math.abs(Math.round(Number(fen) || 0))
  const integer = Math.floor(value / 100)
  const decimal = String(value % 100).padStart(2, '0')
  return `${integer}.${decimal}`
}

function formatFen(fen) {
  const value = Math.round(Number(fen) || 0)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const integer = String(Math.floor(abs / 100))
  const decimal = String(abs % 100).padStart(2, '0')
  const withComma = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${withComma}.${decimal}`
}

function formatTyping(raw) {
  if (!raw) return '0.00'
  const [integerRaw, decimal] = String(raw).split('.')
  const normalized = (integerRaw || '0').replace(/^0+(?=\d)/, '')
  const shown = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (decimal === undefined) return shown
  return `${shown}.${decimal}`
}

module.exports = {
  applyKey,
  rawToFen,
  fenToRaw,
  formatFen,
  formatTyping,
}
