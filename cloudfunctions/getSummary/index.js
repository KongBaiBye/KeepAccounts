const cloud = require('wx-server-sdk')
const { recordsInBranch, tagRows } = require('./tags')

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

async function fetchTags(openid) {
  try {
    const all = []
    for (let skip = 0; skip < 500; skip += 100) {
      const res = await db.collection('tags').where({ _openid: openid }).skip(skip).limit(100).get()
      all.push(...res.data)
      if (res.data.length < 100) break
    }
    return all
  } catch (err) {
    const text = `${err && err.errCode} ${err && (err.errMsg || err.message)}`
    if (text.includes('502005') || text.includes('not exist')) return []
    throw err
  }
}

function summarize(records, grain, tags, options) {
  let expense = 0
  let income = 0
  const trend = {}
  records.forEach((record) => {
    const amount = Math.round(Number(record.amount) || 0)
    if (record.type === 'income') income += amount
    else expense += amount
    const key = shanghaiKey(record.occurredAt, grain)
    if (!trend[key]) trend[key] = { key, expense: 0, income: 0 }
    if (record.type === 'income') trend[key].income += amount
    else trend[key].expense += amount
  })
  return {
    expense,
    income,
    balance: income - expense,
    tags: tagRows(records, tags, options),
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
  const branch = event.scope === 'branch' && event.tagId
  const where = {
    _openid: OPENID,
    occurredAt: _.gte(start).and(_.lt(end)),
  }
  if (event.tagId && !branch) where.tagId = event.tagId
  const options = {
    group: event.group === 'child' ? 'child' : 'parent',
    focusId: branch ? event.tagId : '',
  }

  try {
    const tags = await fetchTags(OPENID)
    const narrow = (records) => (branch ? recordsInBranch(records, event.tagId, tags) : records)
    const currentRecords = narrow(await fetchRecords(where))
    const current = summarize(currentRecords, grain, tags, options)
    let previous = { expense: 0, income: 0, balance: 0 }
    if (event.compare !== false) {
      const duration = end.getTime() - start.getTime()
      const prevWhere = {
        ...where,
        occurredAt: _.gte(new Date(start.getTime() - duration)).and(_.lt(start)),
      }
      const prevRecords = narrow(await fetchRecords(prevWhere))
      previous = summarize(prevRecords, grain, tags, options)
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
