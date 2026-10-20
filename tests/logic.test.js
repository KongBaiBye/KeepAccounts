const assert = require('assert')
const { getRange } = require('../miniprogram/utils/period')
const { applyKey, rawToFen, fenToRaw, formatFen, formatTyping } = require('../miniprogram/utils/money')

function ymd(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

let range = getRange('custom', 0, 10, new Date(2026, 9, 20))
assert.strictEqual(ymd(range.start), '2026-10-11')
assert.strictEqual(ymd(range.end), '2026-11-11')
assert.strictEqual(range.label, '10月11日 – 11月10日')

range = getRange('custom', 0, 10, new Date(2026, 9, 10, 8))
assert.strictEqual(ymd(range.start), '2026-9-11')
assert.strictEqual(ymd(range.end), '2026-10-11')
assert.strictEqual(range.label, '9月11日 – 10月10日')

range = getRange('custom', 0, 20, new Date(2026, 9, 15, 15))
assert.strictEqual(ymd(range.start), '2026-9-21')
assert.strictEqual(ymd(range.end), '2026-10-21')
assert.strictEqual(range.label, '9月21日 – 10月20日')

range = getRange('custom', 0, 20, new Date(2026, 9, 20, 8))
assert.strictEqual(ymd(range.start), '2026-9-21')
assert.strictEqual(ymd(range.end), '2026-10-21')
assert.strictEqual(range.label, '9月21日 – 10月20日')

range = getRange('custom', 1, 20, new Date(2026, 9, 15))
assert.strictEqual(ymd(range.start), '2026-10-21')
assert.strictEqual(ymd(range.end), '2026-11-21')

range = getRange('custom', 0, 31, new Date(2026, 1, 15))
assert.strictEqual(ymd(range.start), '2026-2-1')
assert.strictEqual(ymd(range.end), '2026-3-1')

range = getRange('custom', 0, 31, new Date(2026, 1, 28))
assert.strictEqual(ymd(range.start), '2026-2-1')
assert.strictEqual(ymd(range.end), '2026-3-1')

range = getRange('custom', 1, 31, new Date(2026, 1, 28))
assert.strictEqual(ymd(range.start), '2026-3-1')
assert.strictEqual(ymd(range.end), '2026-4-1')

range = getRange('custom', 0, 31, new Date(2024, 1, 15))
assert.strictEqual(ymd(range.start), '2024-2-1')
assert.strictEqual(ymd(range.end), '2024-3-1')

range = getRange('week', 0, 1, new Date(2026, 9, 20))
assert.strictEqual(ymd(range.start), '2026-10-19')
assert.strictEqual(ymd(range.end), '2026-10-26')
assert.strictEqual(range.label, '10月19日 – 10月25日')

range = getRange('day', 0, 1, new Date(2026, 9, 20, 23))
assert.strictEqual(ymd(range.start), '2026-10-20')
assert.strictEqual(ymd(range.end), '2026-10-21')
assert.strictEqual(range.label, '2026年10月20日')
assert.strictEqual(range.grain, 'day')

range = getRange('month', 1, 1, new Date(2026, 9, 20))
assert.strictEqual(ymd(range.start), '2026-11-1')
assert.strictEqual(ymd(range.end), '2026-12-1')
assert.strictEqual(range.label, '2026年11月')

range = getRange('year', 0, 1, new Date(2026, 9, 20))
assert.strictEqual(ymd(range.start), '2026-1-1')
assert.strictEqual(ymd(range.end), '2027-1-1')
assert.strictEqual(range.grain, 'month')
assert.strictEqual(range.label, '2026年')

assert.strictEqual(applyKey('', '1'), '1')
assert.strictEqual(applyKey('0', '5'), '5')
assert.strictEqual(applyKey('0', '0'), '0')
assert.strictEqual(applyKey('1', '.'), '1.')
assert.strictEqual(applyKey('1.', '2'), '1.2')
assert.strictEqual(applyKey('1.2', '3'), '1.23')
assert.strictEqual(applyKey('1.23', '4'), '1.23')
assert.strictEqual(applyKey('1.23', 'del'), '1.2')
assert.strictEqual(applyKey('', '.'), '0.')
assert.strictEqual(rawToFen('12.3'), 1230)
assert.strictEqual(rawToFen('12.34'), 1234)
assert.strictEqual(rawToFen('12.'), 1200)
assert.strictEqual(rawToFen(''), 0)
assert.strictEqual(fenToRaw(5), '0.05')
assert.strictEqual(fenToRaw(1234), '12.34')
assert.strictEqual(formatFen(123456), '1,234.56')
assert.strictEqual(formatFen(-200), '-2.00')
assert.strictEqual(formatTyping('1234.5'), '1,234.5')
assert.strictEqual(formatTyping(''), '0.00')
assert.strictEqual(formatTyping('0.'), '0.')

console.log('ok')
