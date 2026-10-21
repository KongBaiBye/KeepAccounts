const { compareRecordsDesc } = require('./records')

let canOrderByCreatedAt = true

async function orderedPage(query, skip, limit) {
  if (canOrderByCreatedAt) {
    try {
      return await query
        .orderBy('occurredAt', 'desc')
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    } catch (err) {
      canOrderByCreatedAt = false
    }
  }
  return query.orderBy('occurredAt', 'desc').skip(skip).limit(limit).get()
}

async function queryRecords({ where, skip = 0, limit = 20, looseWhere, test }) {
  const db = wx.cloud.database()
  const collection = db.collection('records')
  try {
    const query = where ? collection.where(where) : collection
    return await orderedPage(query, skip, limit)
  } catch (err) {
    const fallback = looseWhere ? collection.where(looseWhere) : collection
    const res = await fallback.limit(100).get()
    let data = res.data.slice()
    if (test) data = data.filter(test)
    data.sort(compareRecordsDesc)
    return { data: data.slice(skip, skip + limit) }
  }
}

async function getAllTags() {
  const collection = wx.cloud.database().collection('tags')
  const all = []
  for (let skip = 0; skip < 500; skip += 100) {
    const res = await collection.skip(skip).limit(100).get()
    all.push(...res.data)
    if (res.data.length < 100) break
  }
  all.sort((left, right) => (left.sort || 0) - (right.sort || 0))
  return all
}

module.exports = {
  queryRecords,
  getAllTags,
}
