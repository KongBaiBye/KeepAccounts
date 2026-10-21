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

const { groupRecords } = require('../miniprogram/utils/records')
const { buildExport, toJson, buildXlsx, formatExportStamp } = require('../miniprogram/utils/export')

const groups = groupRecords([
  {
    _id: 'later-day',
    amount: 400,
    type: 'expense',
    occurredAt: new Date(2026, 9, 21, 12, 0, 0),
    createdAt: new Date(2026, 9, 21, 9, 0, 0),
  },
  {
    _id: 'noon-early',
    amount: 500,
    type: 'expense',
    occurredAt: new Date(2026, 9, 20, 12, 0, 0),
    createdAt: new Date(2026, 9, 20, 8, 0, 0),
  },
  {
    _id: 'evening',
    amount: 1835,
    type: 'expense',
    occurredAt: new Date(2026, 9, 20, 18, 30, 0),
    createdAt: new Date(2026, 9, 20, 7, 0, 0),
  },
  {
    _id: 'noon-late',
    amount: 2890,
    type: 'expense',
    occurredAt: new Date(2026, 9, 20, 12, 0, 0),
    createdAt: new Date(2026, 9, 20, 19, 0, 0),
  },
])
assert.deepStrictEqual(groups.map((group) => group.dayKey), ['2026-10-21', '2026-10-20'])
assert.deepStrictEqual(groups[1].records.map((record) => record._id), ['evening', 'noon-late', 'noon-early'])
assert.strictEqual(groups[1].subText, '支出 52.25   收入 0.00')

const exportedAt = new Date(2026, 9, 20, 16, 18, 5)
assert.strictEqual(formatExportStamp(exportedAt), '20261020-1618')

const doc = buildExport({
  exportedAt,
  settings: { cycleStartDay: 20 },
  tags: [
    { _id: 'income', name: '工资', icon: 'salary', color: '#9EBEA6', type: 'income', sort: 1, archived: false },
    { _id: 'meal', name: '餐饮', icon: 'meal', color: '#E7A090', type: 'expense', sort: 2, archived: true },
    { _id: 'traffic', name: '交通', icon: 'traffic', color: '#E8C49A', type: 'expense', sort: 1, archived: false },
  ],
  records: [
    {
      _id: 'old',
      amount: 10000,
      type: 'income',
      tagId: 'income',
      tagName: '工资',
      tagColor: '#9EBEA6',
      tagIcon: 'salary',
      note: '',
      occurredAt: new Date(2026, 9, 1, 12, 0, 0),
    },
    {
      _id: 'new',
      amount: 2335,
      type: 'expense',
      tagId: 'traffic',
      tagName: '交通',
      tagColor: '#E8C49A',
      tagIcon: 'traffic',
      note: '午饭 & <面>',
      occurredAt: new Date(2026, 9, 20, 12, 30, 0),
    },
  ],
})

const json = JSON.parse(toJson(doc))
assert.strictEqual(json.version, 1)
assert.strictEqual(json.amountUnit, 'fen')
assert.strictEqual(json.exportedAt, '2026-10-20 16:18:05')
assert.strictEqual(json.settings.cycleStartDay, 20)
assert.deepStrictEqual(json.tags.map((tag) => tag.name), ['交通', '餐饮', '工资'])
assert.strictEqual(json.tags[1].archived, true)
assert.deepStrictEqual(json.records.map((record) => record.id), ['new', 'old'])
const sameDay = buildExport({
  records: [
    {
      _id: 'first',
      amount: 100,
      type: 'expense',
      occurredAt: new Date(2026, 9, 20, 12, 0, 0),
      createdAt: new Date(2026, 9, 20, 8, 0, 0),
    },
    {
      _id: 'second',
      amount: 200,
      type: 'expense',
      occurredAt: new Date(2026, 9, 20, 12, 0, 0),
      createdAt: new Date(2026, 9, 20, 9, 0, 0),
    },
  ],
})
assert.deepStrictEqual(sameDay.records.map((record) => record.id), ['second', 'first'])
assert.strictEqual(json.records[0].amount, 2335)
assert.strictEqual(json.records[0].occurredAt, '2026-10-20 12:30:00')
assert.strictEqual(json.records[0].note, '午饭 & <面>')

function unzipStore(buffer) {
  const bytes = Buffer.from(buffer)
  const files = {}
  let offset = 0
  while (offset + 30 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset)
    if (signature !== 0x04034b50) break
    const method = bytes.readUInt16LE(offset + 8)
    const size = bytes.readUInt32LE(offset + 18)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const name = bytes.slice(nameStart, nameStart + nameLength).toString('utf8')
    const dataStart = nameStart + nameLength + extraLength
    assert.strictEqual(method, 0)
    files[name] = bytes.slice(dataStart, dataStart + size).toString('utf8')
    offset = dataStart + size
  }
  assert.strictEqual(bytes.readUInt32LE(bytes.length - 22), 0x06054b50)
  return files
}

const files = unzipStore(buildXlsx(doc))
assert.ok(files['xl/worksheets/sheet1.xml'].includes('午饭 &amp; &lt;面&gt;'))
assert.ok(files['xl/worksheets/sheet1.xml'].includes('>-23.35</v>'))
assert.ok(files['xl/worksheets/sheet1.xml'].includes('>100.00</v>'))
assert.ok(files['xl/worksheets/sheet2.xml'].includes('餐饮'))
assert.ok(files['xl/worksheets/sheet3.xml'].includes('每月起始日'))
assert.ok(files['xl/workbook.xml'].includes('name="账单"'))

const {
  arrangeTags,
  assignSiblingSort,
  chooseParent,
  exportTagName,
  moveManageRow,
  recordTitle,
  selectionReady,
  tagRows,
  validateTag,
} = require('../miniprogram/utils/tags')
const cloudTags = require('../cloudfunctions/getSummary/tags')

const tree = [
  { _id: 'meal', name: '餐饮', type: 'expense', color: '#E7A090', icon: 'meal', parentId: '', sort: 0 },
  { _id: 'lunch', name: '午餐', type: 'expense', color: '#E8C49A', icon: 'meal', parentId: 'meal', sort: 0 },
  { _id: 'takeout', name: '外卖', type: 'expense', color: '#D4C48A', icon: 'meal', parentId: 'meal', sort: 1 },
  { _id: 'traffic', name: '交通', type: 'expense', color: '#93AEC9', icon: 'traffic', parentId: '', sort: 1 },
]
const bills = [
  { tagId: 'lunch', tagName: '午餐', tagColor: '#E8C49A', tagIcon: 'meal', type: 'expense', amount: 8000 },
  { tagId: 'takeout', tagName: '外卖', tagColor: '#D4C48A', tagIcon: 'meal', type: 'expense', amount: 20000 },
  { tagId: 'meal', tagName: '餐饮', tagColor: '#E7A090', tagIcon: 'meal', type: 'expense', amount: 500 },
  { tagId: 'traffic', tagName: '交通', tagColor: '#93AEC9', tagIcon: 'traffic', type: 'expense', amount: 1000 },
]
assert.deepStrictEqual(tagRows(bills, tree, { group: 'parent' }).map((row) => [row.tagName, row.amount]), [
  ['餐饮', 28500],
  ['交通', 1000],
])
assert.deepStrictEqual(tagRows(bills, tree, { group: 'child' }).map((row) => row.tagName), ['外卖', '午餐', '交通', '餐饮'])
const focused = tagRows(bills.filter((row) => row.tagId !== 'traffic'), tree, { group: 'child', focusId: 'meal' })
assert.deepStrictEqual(focused.map((row) => [row.tagName, row.direct, row.amount]), [
  ['外卖', false, 20000],
  ['午餐', false, 8000],
  ['未细分', true, 500],
])
assert.deepStrictEqual(tagRows(bills, tree, { group: 'parent' }), cloudTags.tagRows(bills, tree, { group: 'parent' }))
assert.deepStrictEqual(focused, cloudTags.tagRows(bills.filter((row) => row.tagId !== 'traffic'), tree, { group: 'child', focusId: 'meal' }))
assert.deepStrictEqual(arrangeTags(tree, 'expense').map((row) => row._id), ['meal', 'lunch', 'takeout', 'traffic'])
const movedParent = moveManageRow(arrangeTags(tree, 'expense'), 0, 1)
assert.deepStrictEqual(movedParent.map((row) => row._id), ['traffic', 'meal', 'lunch', 'takeout'])
const movedChild = moveManageRow(arrangeTags(tree, 'expense'), 1, 1)
assert.deepStrictEqual(movedChild.map((row) => row._id), ['meal', 'takeout', 'lunch', 'traffic'])
assert.deepStrictEqual(assignSiblingSort(movedChild).filter((row) => row.parentId === 'meal').map((row) => row.sort), [0, 1])
assert.strictEqual(recordTitle({ tagId: 'takeout', tagName: '外卖' }, tree), '餐饮 · 外卖')
assert.strictEqual(exportTagName({ tagId: 'takeout', tagName: '外卖' }, tree), '餐饮 / 外卖')
assert.strictEqual(recordTitle({ tagId: 'traffic', tagName: '交通' }, tree), '交通')
const picked = chooseParent(tree, { type: 'expense', parentId: 'meal' })
assert.strictEqual(picked.needsChild, true)
assert.strictEqual(picked.tagId, '')
assert.strictEqual(selectionReady(picked, ''), false)
const kept = chooseParent(tree, { type: 'expense', parentId: 'meal', tagId: 'meal', keepId: 'meal' })
assert.strictEqual(kept.tagId, 'meal')
assert.strictEqual(selectionReady(kept, 'meal'), true)
const plain = chooseParent(tree, { type: 'expense', parentId: 'traffic' })
assert.strictEqual(plain.tagId, 'traffic')
assert.strictEqual(plain.needsChild, false)
assert.strictEqual(validateTag(tree, { name: '午餐', type: 'expense', parentId: 'meal' }), '同一级已经有这个名称')
assert.strictEqual(validateTag(tree, { name: '早餐', type: 'expense', parentId: 'meal' }), '')
assert.strictEqual(validateTag(tree, { id: 'meal', name: '餐饮', type: 'expense', parentId: 'traffic' }), '已有下级，不能再挂到别的标签下')

const nestedExport = buildExport({
  tags: tree,
  records: [{
    _id: 'takeout-bill',
    amount: 20000,
    type: 'expense',
    tagId: 'takeout',
    tagName: '外卖',
    occurredAt: new Date(2026, 9, 20, 12, 0, 0),
    createdAt: new Date(2026, 9, 20, 13, 0, 0),
  }],
})
assert.strictEqual(nestedExport.records[0].tagName, '餐饮 / 外卖')
assert.strictEqual(nestedExport.tags.find((tag) => tag.id === 'takeout').parentName, '餐饮')

console.log('ok')
