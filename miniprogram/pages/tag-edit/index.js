const { COLORS, ICONS } = require('../../utils/constants')
const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')

Page({
  data: {
    ready: false,
    id: '',
    name: '',
    icon: ICONS[0].key,
    color: COLORS[0],
    type: 'expense',
    archived: false,
    icons: ICONS,
    colors: COLORS,
  },

  onLoad(options) {
    this.tagId = options.id || ''
    this.setData({
      id: this.tagId,
      type: options.type === 'income' ? 'income' : 'expense',
    })
    wx.setNavigationBarTitle({ title: this.tagId ? '编辑标签' : '新建标签' })
  },

  async onShow() {
    const user = await guard()
    if (!user) return
    if (this.tagId && !this.hydrated) {
      await this.loadTag()
      this.hydrated = true
    }
    this.setData({ ready: true })
  },

  async loadTag() {
    try {
      const res = await wx.cloud.database().collection('tags').doc(this.tagId).get()
      const tag = res.data
      this.setData({
        name: tag.name,
        icon: tag.icon,
        color: tag.color,
        type: tag.type,
        archived: !!tag.archived,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '标签没有找到', icon: 'none' })
    }
  },

  onName(event) {
    this.setData({ name: event.detail.value.slice(0, 8) })
  },

  onIcon(event) {
    this.setData({ icon: event.currentTarget.dataset.key })
  },

  onColor(event) {
    this.setData({ color: event.currentTarget.dataset.color })
  },

  onType(event) {
    this.setData({ type: event.currentTarget.dataset.type })
  },

  async onSave() {
    const name = (this.data.name || '').trim().slice(0, 8)
    if (!name || this.saving) {
      if (!name) wx.showToast({ title: '请填写名称', icon: 'none' })
      return
    }
    this.saving = true
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const db = wx.cloud.database()
      const payload = {
        name,
        icon: this.data.icon,
        color: this.data.color,
        type: this.data.type,
        updatedAt: db.serverDate(),
      }
      if (this.tagId) {
        await db.collection('tags').doc(this.tagId).update({ data: payload })
      } else {
        const tags = await getAllTags()
        const sort = tags
          .filter((tag) => tag.type === this.data.type)
          .reduce((max, tag) => Math.max(max, tag.sort || 0), -1) + 1
        await db.collection('tags').add({
          data: {
            ...payload,
            sort,
            archived: false,
            createdAt: db.serverDate(),
          },
        })
      }
      wx.navigateBack()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '没有保存成功', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.saving = false
    }
  },

  onToggleArchive() {
    this.updateArchived(!this.data.archived)
  },

  onDelete() {
    wx.showModal({
      title: '删除这个标签？',
      content: '如果已有账单用过，会改为归档，旧账单仍显示原来的样子。',
      confirmColor: '#E85D4C',
      success: async (res) => {
        if (!res.confirm || !this.tagId) return
        try {
          const db = wx.cloud.database()
          const used = await db.collection('records').where({ tagId: this.tagId }).count()
          if (used.total > 0) {
            await this.updateArchived(true, false)
          } else {
            await db.collection('tags').doc(this.tagId).remove()
          }
          wx.navigateBack()
        } catch (err) {
          console.error(err)
          wx.showToast({ title: '没有删除成功', icon: 'none' })
        }
      },
    })
  },

  async updateArchived(archived, back = true) {
    const db = wx.cloud.database()
    await db.collection('tags').doc(this.tagId).update({
      data: { archived, updatedAt: db.serverDate() },
    })
    this.setData({ archived })
    if (back) wx.navigateBack()
  },
})
