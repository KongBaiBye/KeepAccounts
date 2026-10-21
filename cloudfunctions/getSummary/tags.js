function tagParentId(tag) {
  return (tag && tag.parentId) || ''
}

function indexTags(tags) {
  const byId = {}
  ;(tags || []).forEach((tag) => {
    if (tag && tag._id) byId[tag._id] = tag
  })
  return byId
}

function hasChildren(tags, id) {
  if (!id) return false
  return (tags || []).some((tag) => tagParentId(tag) === id)
}

function branchIds(tagId, tags) {
  const ids = []
  if (tagId) ids.push(tagId)
  ;(tags || []).forEach((tag) => {
    if (tag && tag._id && tagParentId(tag) === tagId && !ids.includes(tag._id)) ids.push(tag._id)
  })
  return ids
}

function recordsInBranch(records, tagId, tags) {
  const ids = new Set(branchIds(tagId, tags))
  return (records || []).filter((record) => ids.has(record.tagId))
}

function tagRows(records, tags, options = {}) {
  const group = options.group === 'child' ? 'child' : 'parent'
  const focusId = options.focusId || ''
  const byId = indexTags(tags)
  const splitDirect = group === 'child' && focusId && hasChildren(tags, focusId)
  const buckets = {}
  ;(records || []).forEach((record) => {
    const amount = Math.round(Number(record.amount) || 0)
    const own = byId[record.tagId]
    let key = record.tagId || 'unknown'
    let direct = false
    if (splitDirect && record.tagId === focusId) {
      key = `direct:${focusId}`
      direct = true
    } else if (group === 'parent' && own && tagParentId(own) && byId[tagParentId(own)]) {
      key = tagParentId(own)
    }
    if (!buckets[key]) {
      const source = direct ? byId[focusId] : byId[key]
      buckets[key] = {
        tagId: direct ? focusId : key,
        tagName: direct ? '未细分' : (source && source.name) || record.tagName || '未分类',
        tagColor: (source && source.color) || record.tagColor || '#B0A4C8',
        tagIcon: (source && source.icon) || record.tagIcon || 'more',
        type: (source && source.type) || record.type,
        amount: 0,
        direct,
      }
    }
    buckets[key].amount += amount
  })
  return Object.keys(buckets).map((key) => buckets[key]).sort((left, right) => (
    right.amount - left.amount || left.tagName.localeCompare(right.tagName, 'zh')
  ))
}

module.exports = {
  branchIds,
  recordsInBranch,
  tagRows,
}
