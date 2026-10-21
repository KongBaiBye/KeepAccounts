const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')
const { arrangeTags, assignSiblingSort, hasChildren, moveManageRow } = require('../../utils/tags')

function splitTags(tags) {
  const decorate = (type) => arrangeTags(tags, type).map((tag) => ({ ...tag, offset: 0 }))
  return {
    expenseTags: decorate('expense'),
    incomeTags: decorate('income'),
  }
}

Page({
  data: {
    ready: false,
    expenseTags: [],
    incomeTags: [],
  },

  async onShow() {
    const user = await guard()
    if (!user) return
    this.setData({ ready: true })
    this.reload()
  },

  async reload() {
    try {
      const tags = await getAllTags()
      this.setData(splitTags(tags))
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '标签暂时没有拿到', icon: 'none' })
    }
  },

  create() {
    wx.showActionSheet({
      itemList: ['支出标签', '收入标签'],
      success: (res) => {
        const type = res.tapIndex === 1 ? 'income' : 'expense'
        wx.navigateTo({ url: `/pages/tag-edit/index?type=${type}` })
      },
    })
  },

  openTag(event) {
    const id = event.currentTarget.dataset.id
    const type = event.currentTarget.dataset.type
    const list = this.listOf(type)
    const current = list.find((tag) => tag._id === id)
    if (current && current.offset) {
      this.setOffset(type, id, 0)
      return
    }
    wx.navigateTo({ url: `/pages/tag-edit/index?id=${id}` })
  },

  listOf(type) {
    return type === 'income' ? this.data.incomeTags : this.data.expenseTags
  },

  keyOf(type) {
    return type === 'income' ? 'incomeTags' : 'expenseTags'
  },

  setOffset(type, id, offset) {
    const key = this.keyOf(type)
    const list = this.listOf(type).map((tag) => ({
      ...tag,
      offset: tag._id === id ? offset : 0,
    }))
    this.setData({ [key]: list })
  },

  onSwipeStart(event) {
    this.swipe = {
      id: event.currentTarget.dataset.id,
      type: event.currentTarget.dataset.type,
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      axis: '',
    }
  },

  onSwipeMove(event) {
    if (!this.swipe) return
    const dx = event.touches[0].clientX - this.swipe.x
    const dy = event.touches[0].clientY - this.swipe.y
    if (!this.swipe.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      this.swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (this.swipe.axis !== 'x') return
    this.setOffset(this.swipe.type, this.swipe.id, Math.max(-88, Math.min(0, dx)))
  },

  onSwipeEnd() {
    if (!this.swipe || this.swipe.axis !== 'x') {
      this.swipe = null
      return
    }
    const list = this.listOf(this.swipe.type)
    const current = list.find((tag) => tag._id === this.swipe.id)
    const offset = current && current.offset < -40 ? -88 : 0
    this.setOffset(this.swipe.type, this.swipe.id, offset)
    this.swipe = null
  },

  onDragStart(event) {
    this.drag = {
      type: event.currentTarget.dataset.type,
      index: Number(event.currentTarget.dataset.index),
      y: event.touches[0].clientY,
      moved: false,
    }
    this.rowHeight = 64
  },

  onDragMove(event) {
    if (!this.drag) return
    const dy = event.touches[0].clientY - this.drag.y
    let shift = Math.round(dy / this.rowHeight)
    if (!shift) return
    const key = this.keyOf(this.drag.type)
    let list = this.listOf(this.drag.type).slice()
    const id = list[this.drag.index] && list[this.drag.index]._id
    let guard = 0
    while (shift !== 0 && guard < 8) {
      const direction = shift > 0 ? 1 : -1
      const next = moveManageRow(list, this.drag.index, direction)
      if (next === list) break
      list = next
      this.drag.index = list.findIndex((row) => row._id === id)
      shift -= direction
      guard += 1
    }
    if (!guard) return
    this.drag.y = event.touches[0].clientY
    this.drag.moved = true
    this.setData({ [key]: list })
  },

  async onDragEnd() {
    if (!this.drag) return
    const moved = this.drag.moved
    const type = this.drag.type
    this.drag = null
    if (!moved) return
    const list = this.listOf(type)
    const previous = {}
    list.forEach((tag) => {
      previous[tag._id] = tag.sort || 0
    })
    const indexed = assignSiblingSort(list)
    const key = this.keyOf(type)
    this.setData({ [key]: indexed })
    const db = wx.cloud.database()
    try {
      await Promise.all(indexed.map((tag) => {
        if ((tag.sort || 0) === (previous[tag._id] || 0)) return Promise.resolve()
        return db.collection('tags').doc(tag._id).update({
          data: { sort: tag.sort, updatedAt: db.serverDate() },
        })
      }))
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '排序没有保存', icon: 'none' })
      this.reload()
    }
  },

  onToggle(event) {
    const id = event.currentTarget.dataset.id
    const disabled = Number(event.currentTarget.dataset.disabled) === 1
    const apply = async () => {
      try {
        const db = wx.cloud.database()
        await db.collection('tags').doc(id).update({
          data: { archived: !disabled, updatedAt: db.serverDate() },
        })
        this.reload()
      } catch (err) {
        console.error(err)
        wx.showToast({ title: disabled ? '没有恢复' : '没有停用', icon: 'none' })
      }
    }
    if (disabled) {
      apply()
      return
    }
    const list = this.data.expenseTags.concat(this.data.incomeTags)
    const withChildren = hasChildren(list, id)
    wx.showModal({
      title: '停用这个标签？',
      content: withChildren
        ? '停用后不能再用来记账，它的下级也不会出现在记一笔里。已经记过的账单不受影响。'
        : '停用后不能再用来记账，会排到同级的最下面。已经记过的账单不受影响。',
      confirmColor: '#1F2A37',
      success: (res) => {
        if (res.confirm) apply()
      },
    })
  },
})
