function isMissing(err) {
  const text = `${err && err.errCode} ${err && (err.errMsg || err.message)}`
  return text.includes('502005') || text.toLowerCase().includes('not exist')
}

async function countTagRecords(tagId) {
  const db = wx.cloud.database()
  try {
    const res = await db.collection('records').where({ tagId }).count()
    return res.total || 0
  } catch (err) {
    if (isMissing(err)) return 0
    throw err
  }
}

async function archiveTag(id) {
  const db = wx.cloud.database()
  await db.collection('tags').doc(id).update({
    data: { archived: true, updatedAt: db.serverDate() },
  })
}

async function removeTagBranch(tags, id) {
  const list = tags || []
  const root = list.find((tag) => tag._id === id)
  if (!root) return { removed: 0, archived: 0 }
  const children = list.filter((tag) => (tag.parentId || '') === id)
  const db = wx.cloud.database()
  let removed = 0
  let archived = 0
  let keptChild = false
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const count = await countTagRecords(child._id)
    if (count > 0) {
      keptChild = true
      archived += 1
      if (!child.archived) await archiveTag(child._id)
    } else {
      await db.collection('tags').doc(child._id).remove()
      removed += 1
    }
  }
  const count = await countTagRecords(root._id)
  if (count > 0 || keptChild) {
    archived += 1
    if (!root.archived) await archiveTag(root._id)
  } else {
    await db.collection('tags').doc(root._id).remove()
    removed += 1
  }
  return { removed, archived }
}

function removalMessage(result) {
  if (result && result.archived && result.removed) return '没有账单的已删除，有账单的已停用'
  if (result && result.archived) return '已有账单，改为停用'
  return '已删除'
}

module.exports = {
  removeTagBranch,
  removalMessage,
}
