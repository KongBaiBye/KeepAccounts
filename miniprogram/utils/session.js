const { COLORS } = require('./constants')

const DEFAULT_TAGS = [
  { name: '餐饮', icon: 'meal', type: 'expense' },
  { name: '交通', icon: 'traffic', type: 'expense' },
  { name: '购物', icon: 'shopping', type: 'expense' },
  { name: '居住', icon: 'home', type: 'expense' },
  { name: '娱乐', icon: 'fun', type: 'expense' },
  { name: '医疗', icon: 'medical', type: 'expense' },
  { name: '其他', icon: 'more', type: 'expense' },
  { name: '工资', icon: 'salary', type: 'income' },
  { name: '其他', icon: 'more', type: 'income' },
]

function errorText(err) {
  return `${(err && err.errCode) || ''} ${(err && (err.errMsg || err.message)) || ''}`
}

function isMissingCollection(err) {
  const text = errorText(err)
  return text.includes('502005')
    || text.includes('DATABASE_COLLECTION_NOT_EXIST')
    || text.includes('Db or Table not exist')
    || text.toLowerCase().includes('not exist')
}

function isMissingFunction(err) {
  const text = errorText(err)
  return text.includes('-501000')
    || text.includes('FUNCTION_NOT_FOUND')
    || text.includes('FunctionName')
}

function loadUserOnce() {
  const app = getApp()
  if (app.globalData.user) return Promise.resolve(app.globalData.user)
  if (!app.globalData.sessionPromise) {
    app.globalData.sessionPromise = fetchUser().then((user) => {
      if (user) app.globalData.user = user
      return user
    }).catch((err) => {
      app.globalData.sessionPromise = null
      throw err
    })
  }
  return app.globalData.sessionPromise
}

async function fetchUser() {
  try {
    const res = await wx.cloud.database().collection('users').limit(1).get()
    return res.data[0] || null
  } catch (err) {
    if (isMissingCollection(err)) return null
    throw err
  }
}

async function seedTagsFromClient() {
  const db = wx.cloud.database()
  let total = 0
  try {
    const existed = await db.collection('tags').count()
    total = existed.total
  } catch (err) {
    if (isMissingCollection(err)) return { created: false }
    throw err
  }
  if (total > 0) return { created: false }
  const now = db.serverDate()
  const sortByType = { expense: 0, income: 0 }
  await Promise.all(DEFAULT_TAGS.map((tag, index) => {
    const sort = sortByType[tag.type]
    sortByType[tag.type] += 1
    return db.collection('tags').add({
      data: {
        name: tag.name,
        icon: tag.icon,
        color: COLORS[index % COLORS.length],
        type: tag.type,
        sort,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    })
  }))
  return { created: true, source: 'client' }
}

function initCloudData() {
  return wx.cloud.callFunction({ name: 'ensureDefaultTags' }).then((res) => res.result || {}).catch((err) => {
    if (!isMissingFunction(err)) throw err
    return seedTagsFromClient()
  })
}

function ensureTags() {
  const app = getApp()
  if (!app.globalData.tagsPromise) {
    app.globalData.tagsPromise = initCloudData().catch((err) => {
      app.globalData.tagsPromise = null
      console.error(err)
    })
  }
  return app.globalData.tagsPromise
}

async function guard() {
  const app = getApp()
  if (!wx.cloud) {
    wx.showToast({ title: '请升级基础库', icon: 'none' })
    return null
  }
  if (app.globalData.loggedOut) {
    wx.reLaunch({ url: '/pages/login/index' })
    return null
  }
  try {
    const user = await loadUserOnce()
    if (app.globalData.loggedOut || !user) {
      wx.reLaunch({ url: '/pages/login/index' })
      return null
    }
    ensureTags()
    return user
  } catch (err) {
    console.error(err)
    wx.showToast({ title: '暂时连不上云开发', icon: 'none' })
    return null
  }
}

function markLoggedOut() {
  getApp().globalData.loggedOut = true
}

function markEntered(user) {
  const app = getApp()
  app.globalData.loggedOut = false
  if (user) {
    app.globalData.user = user
    app.globalData.sessionPromise = Promise.resolve(user)
  }
}

module.exports = {
  isMissingCollection,
  loadUserOnce,
  initCloudData,
  ensureTags,
  guard,
  markLoggedOut,
  markEntered,
}
