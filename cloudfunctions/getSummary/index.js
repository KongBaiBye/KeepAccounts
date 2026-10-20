const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

function pad(number) {
  return String(number).padStart(2, '0')
}

function shanghaiKey(value, grain) {
  const date = value instanceof Date ? value : new Date(value)
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = pad(shifted.getUTCMonth() + 1)
  if (grain === 'month') return `${year}-${month}`
  const day = pad(shifted.getUTCDate())
  return `${year}-${month}-${day}`
}

async function fetchRecords(where) {
  const all = []
  const pageSize = 100
  for (let skip = 0; skip < 5000; skip += pageSize) {
    const res = await db.collection('records').where(where).skip(skip).limit(pageSize).get()
    all.push(...res.data)
    if (res.data.length < pageSize) break
  }
  return all
}

function summarize(records, grain) {
  let expense = 0
  let income = 0
  const tags = {}
  const trend = {}
  records.forEach((record) => {
    const amount = Math.round(Number(record.amount) || 0)
    if (record.type === 'income') income += amount
    else expense += amount
    const tagId = record.tagId || 'unknown'
    if (!tags[tagId]) {
      tags[tagId] = {
        tagId,
        tagName: record.tagName || '未分类',
        tagColor: record.tagColor || '#B0A4C8',
        tagIcon: record.tagIcon || 'more',
        type: record.type,
        amount: 0,
        time: 0,
      }
    }
    const bucket = tags[tagId]
    bucket.amount += amount
    const time = new Date(record.occurredAt).getTime() || 0
    if (time >= bucket.time) {
      bucket.time = time
      bucket.tagName = record.tagName || bucket.tagName
      bucket.tagColor = record.tagColor || bucket.tagColor
      bucket.tagIcon = record.tagIcon || bucket.tagIcon
      bucket.type = record.type
    }
    const key = shanghaiKey(record.occurredAt, grain)
    if (!trend[key]) trend[key] = { key, expense: 0, income: 0 }
    if (record.type === 'income') trend[key].income += amount
    else trend[key].expense += amount
  })
  return {
    expense,
    income,
    balance: income - expense,
    tags: Object.keys(tags).map((key) => {
      const item = tags[key]
      return {
        tagId: item.tagId,
        tagName: item.tagName,
        tagColor: item.tagColor,
        tagIcon: item.tagIcon,
        type: item.type,
        amount: item.amount,
      }
    }).sort((a, b) => b.amount - a.amount),
    trend: Object.keys(trend).map((key) => trend[key]),
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: '未登录' }
  const start = new Date(Number(event.start))
  const end = new Date(Number(event.end))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { error: '时间范围无效' }
  }

  const grain = event.grain === 'month' ? 'month' : 'day'
  const where = {
    _openid: OPENID,
    occurredAt: _.gte(start).and(_.lt(end)),
  }
  if (event.tagId) where.tagId = event.tagId

  try {
    const currentRecords = await fetchRecords(where)
    const current = summarize(currentRecords, grain)
    let previous = { expense: 0, income: 0, balance: 0 }
    if (event.compare !== false) {
      const duration = end.getTime() - start.getTime()
      const prevWhere = {
        ...where,
        occurredAt: _.gte(new Date(start.getTime() - duration)).and(_.lt(start)),
      }
      const prevRecords = await fetchRecords(prevWhere)
      previous = summarize(prevRecords, grain)
    }
    return {
      expense: current.expense,
      income: current.income,
      balance: current.balance,
      prevExpense: previous.expense,
      prevIncome: previous.income,
      prevBalance: previous.balance,
      tags: event.detail === false ? [] : current.tags,
      trend: event.detail === false ? [] : current.trend,
    }
  } catch (err) {
    const text = `${err && err.errCode} ${err && (err.errMsg || err.message)}`
    if (text.includes('502005') || text.includes('not exist')) {
      return {
        expense: 0,
        income: 0,
        balance: 0,
        prevExpense: 0,
        prevIncome: 0,
        prevBalance: 0,
        tags: [],
        trend: [],
      }
    }
    return { error: '统计失败' }
  }
}
