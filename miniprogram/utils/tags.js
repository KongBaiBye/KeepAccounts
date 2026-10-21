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

function bySort(left, right) {
  const diff = (left.sort || 0) - (right.sort || 0)
  if (diff) return diff
  return String(left._id || '').localeCompare(String(right._id || ''))
}

function orderActiveFirst(list) {
  return list.filter((tag) => !tag.archived).sort(bySort)
    .concat(list.filter((tag) => tag.archived).sort(bySort))
}

function arrangeTags(tags, type) {
  const list = (tags || [])
    .filter((tag) => tag.type === type)
    .map((tag) => ({ ...tag, parentId: tagParentId(tag) }))
  const parents = list.filter((tag) => !tag.parentId)
  const parentIds = {}
  parents.forEach((tag) => {
    parentIds[tag._id] = true
  })
  const childrenOf = {}
  const orphans = []
  list.forEach((tag) => {
    if (!tag.parentId) return
    if (!parentIds[tag.parentId]) {
      orphans.push(tag)
      return
    }
    if (!childrenOf[tag.parentId]) childrenOf[tag.parentId] = []
    childrenOf[tag.parentId].push(tag)
  })
  const rows = []
  orderActiveFirst(parents).forEach((parent) => {
    rows.push({ ...parent, depth: 0 })
    orderActiveFirst(childrenOf[parent._id] || []).forEach((child) => {
      rows.push({ ...child, depth: 1 })
    })
  })
  orderActiveFirst(orphans).forEach((child) => {
    rows.push({ ...child, depth: 1 })
  })
  return rows
}

function moveManageRow(rows, index, direction) {
  const current = rows && rows[index]
  if (!current || current.archived || !direction) return rows
  const key = tagParentId(current)
  const siblingIndexes = []
  rows.forEach((row, rowIndex) => {
    if (!row.archived && tagParentId(row) === key) siblingIndexes.push(rowIndex)
  })
  const pos = siblingIndexes.indexOf(index)
  const next = pos + direction
  if (pos < 0 || next < 0 || next >= siblingIndexes.length) return rows
  return swapBlocks(rows, siblingIndexes[pos], siblingIndexes[next])
}

function blockEnd(rows, index) {
  const row = rows[index]
  if (!row || tagParentId(row)) return index + 1
  let end = index + 1
  while (end < rows.length && tagParentId(rows[end]) === row._id) end += 1
  return end
}

function swapBlocks(rows, left, right) {
  const start = Math.min(left, right)
  const end = Math.max(left, right)
  const startEnd = blockEnd(rows, start)
  const endEnd = blockEnd(rows, end)
  if (startEnd > end) return rows
  return rows.slice(0, start)
    .concat(rows.slice(end, endEnd), rows.slice(startEnd, end), rows.slice(start, startEnd), rows.slice(endEnd))
}

function assignSiblingSort(rows) {
  const seen = {}
  return (rows || []).map((row) => {
    const key = `${row.type || ''}:${tagParentId(row)}`
    const sort = seen[key] || 0
    seen[key] = sort + 1
    return { ...row, sort }
  })
}

function parentChoices(tags, { type, selfId = '', currentParentId = '' } = {}) {
  if (selfId && hasChildren(tags, selfId)) return []
  return (tags || []).filter((tag) => {
    if (!tag || tag._id === selfId) return false
    if (tag.type !== type || tagParentId(tag)) return false
    if (tag.archived && tag._id !== currentParentId) return false
    return true
  }).sort(bySort)
}

function validateTag(tags, { id = '', name, type, parentId = '' } = {}) {
  const parent = parentId ? (tags || []).find((tag) => tag._id === parentId) : null
  if (parentId && !parent) return '上级没有找到'
  if (parent && tagParentId(parent)) return '只能挂在父级下面'
  if (parent && parent.type !== type) return '上级类型不一致'
  if (id && parentId === id) return '不能把自己设为上级'
  if (parentId && id && hasChildren(tags, id)) return '已有下级，不能再挂到别的标签下'
  const taken = (tags || []).some((tag) => (
    tag._id !== id
    && tag.type === type
    && tagParentId(tag) === (parentId || '')
    && tag.name === name
  ))
  if (taken) return '同一级已经有这个名称'
  return ''
}

function visibleParent(tag, type, keep, keepId) {
  if (!tag || tag.type !== type || tagParentId(tag)) return false
  if (!tag.archived) return true
  if (tag._id === keepId) return true
  return !!(keep && tagParentId(keep) === tag._id)
}

function selectionModel(tags, { type, parentTagId = '', tagId = '', keepId = '' } = {}) {
  const list = tags || []
  const byId = indexTags(list)
  const keep = byId[keepId]
  const parents = list.filter((tag) => visibleParent(tag, type, keep, keepId)).sort(bySort)
  let parentId = parentTagId || ''
  if (!parentId && tagId && byId[tagId]) {
    const selected = byId[tagId]
    parentId = tagParentId(selected) || (visibleParent(selected, type, keep, keepId) ? tagId : '')
  }
  if (parentId && !parents.some((tag) => tag._id === parentId)) parentId = ''
  const children = parentId ? list.filter((tag) => {
    if (!tag || tag.type !== type || tagParentId(tag) !== parentId) return false
    if (!tag.archived) return true
    return tag._id === keepId || tag._id === tagId
  }).sort(bySort) : []
  const needsChild = children.some((tag) => !tag.archived)
  return {
    parents,
    children,
    parentTagId: parentId,
    tagId: tagId || '',
    needsChild,
  }
}

function chooseParent(tags, { type, parentId, tagId = '', keepId = '' } = {}) {
  const model = selectionModel(tags, {
    type,
    parentTagId: parentId,
    tagId,
    keepId,
  })
  const childIds = {}
  model.children.forEach((tag) => {
    childIds[tag._id] = true
  })
  let nextTagId = ''
  if (keepId && keepId === parentId) nextTagId = parentId
  else if (tagId && childIds[tagId]) nextTagId = tagId
  else if (!model.needsChild) nextTagId = parentId
  return { ...model, parentTagId: parentId, tagId: nextTagId }
}

function selectionReady(state, keepId) {
  const tagId = (state && state.tagId) || ''
  if (!tagId) return false
  if (!state.needsChild) return true
  if (tagId !== state.parentTagId) return true
  return !!keepId && tagId === keepId
}

function asIndex(tags) {
  if (Array.isArray(tags)) return indexTags(tags)
  return tags || {}
}

function recordTitle(record, tags) {
  const name = (record && record.tagName) || '未分类'
  const byId = asIndex(tags)
  const tag = byId[record && record.tagId]
  const parent = tag && tagParentId(tag) ? byId[tagParentId(tag)] : null
  if (parent && parent.name) return `${parent.name} · ${name}`
  return name
}

function exportTagName(record, tags) {
  const name = (record && record.tagName) || ''
  const byId = asIndex(tags)
  const tag = byId[record && record.tagId]
  const parent = tag && tagParentId(tag) ? byId[tagParentId(tag)] : null
  if (parent && parent.name && name) return `${parent.name} / ${name}`
  return name
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
  tagParentId,
  indexTags,
  hasChildren,
  branchIds,
  arrangeTags,
  moveManageRow,
  assignSiblingSort,
  parentChoices,
  validateTag,
  selectionModel,
  chooseParent,
  selectionReady,
  recordTitle,
  exportTagName,
  tagRows,
}
