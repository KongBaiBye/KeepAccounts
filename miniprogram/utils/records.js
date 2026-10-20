const { formatFen } = require('./money')
const { toDate, dayKey, formatDayLabel } = require('./time')

function decorateRecord(record) {
  const date = toDate(record.occurredAt)
  return {
    ...record,
    amountText: `${record.type === 'income' ? '+' : '-'}${formatFen(record.amount)}`,
    dayKey: dayKey(date),
    dayLabel: formatDayLabel(date),
  }
}

function groupRecords(records) {
  const groups = []
  const index = {}
  records.forEach((record) => {
    const item = decorateRecord(record)
    if (index[item.dayKey] === undefined) {
      index[item.dayKey] = groups.length
      groups.push({
        dayKey: item.dayKey,
        label: item.dayLabel,
        records: [],
        expense: 0,
        income: 0,
      })
    }
    const group = groups[index[item.dayKey]]
    group.records.push(item)
    if (item.type === 'income') group.income += item.amount
    else group.expense += item.amount
  })
  return groups.map((group) => ({
    ...group,
    subText: `支出 ${formatFen(group.expense)}   收入 ${formatFen(group.income)}`,
  }))
}

module.exports = {
  decorateRecord,
  groupRecords,
}
