const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')

function splitTags(tags) {
  const decorate = (type) => tags
    .filter((tag) => tag.type === type)
    .sort((left, right) => (left.sort || 0) - (right.sort || 0))
    .map((tag) => ({ ...tag, offset: 0 }))
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
    this.setOffset(this.swipe.type, this.swipe.id, Math.max(-140, Math.min(0, dx)))
  },

  onSwipeEnd() {
    if (!this.swipe || this.swipe.axis !== 'x') {
      this.swipe = null
      return
    }
    const list = this.listOf(this.swipe.type)
    const current = list.find((tag) => tag._id === this.swipe.id)
    const offset = current && current.offset < -50 ? -140 : 0
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
    const shift = Math.round(dy / this.rowHeight)
    if (!shift) return
    const key = this.keyOf(this.drag.type)
    const list = this.listOf(this.drag.type).slice()
    const next = this.drag.index + shift
    if (next < 0 || next >= list.length) return
    const [item] = list.splice(this.drag.index, 1)
    list.splice(next, 0, item)
    this.drag.index = next
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
    const db = wx.cloud.database()
    try {
      await Promise.all(list.map((tag, index) => {
        if (tag.sort === index) return Promise.resolve()
        return db.collection('tags').doc(tag._id).update({
          data: { sort: index, updatedAt: db.serverDate() },
        })
      }))
      list.forEach((tag, index) => {
        tag.sort = index
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '排序没有保存', icon: 'none' })
      this.reload()
    }
  },

  onArchive(event) {
    const id = event.currentTarget.dataset.id
    const archived = Number(event.currentTarget.dataset.archived) === 1
    wx.showModal({
      title: archived ? '恢复这个标签？' : '归档这个标签？',
      content: archived ? '恢复后可以继续用于记账。' : '归档后，记新账时不会再出现。旧账单仍显示原来的样子。',
      confirmColor: '#1F2A37',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const db = wx.cloud.database()
          await db.collection('tags').doc(id).update({
            data: { archived: !archived, updatedAt: db.serverDate() },
          })
          this.reload()
        } catch (err) {
          console.error(err)
          wx.showToast({ title: '没有改成', icon: 'none' })
        }
      },
    })
  },
})
