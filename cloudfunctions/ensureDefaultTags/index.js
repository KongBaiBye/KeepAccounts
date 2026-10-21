const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()

const COLORS = [
  '#E7A090',
  '#E8C49A',
  '#D4C48A',
  '#9EBEA6',
  '#8FB8B0',
  '#93AEC9',
  '#B0A4C8',
  '#C7A3B0',
]

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

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (err) {
    // 集合已存在时创建会失败，继续即可。
  }
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: '未登录' }

  await Promise.all(['users', 'tags', 'records', 'settings'].map(ensureCollection))

  const existed = await db.collection('tags').where({ _openid: OPENID }).count()
  if (existed.total > 0) return { created: false }

  const now = new Date()
  const expenseSort = { expense: 0, income: 0 }
  await Promise.all(DEFAULT_TAGS.map((tag, index) => {
    const sort = expenseSort[tag.type]
    expenseSort[tag.type] += 1
    return db.collection('tags').add({
      data: {
        _openid: OPENID,
        name: tag.name,
        icon: tag.icon,
        color: COLORS[index % COLORS.length],
        type: tag.type,
        parentId: '',
        sort,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    })
  }))
  return { created: true }
}
