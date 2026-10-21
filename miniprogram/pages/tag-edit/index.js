const { COLORS, ICONS } = require('../../utils/constants')
const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')
const { hasChildren, parentChoices, tagParentId, validateTag } = require('../../utils/tags')

Page({
  data: {
    ready: false,
    id: '',
    name: '',
    icon: ICONS[0].key,
    color: COLORS[0],
    type: 'expense',
    parentId: '',
    parentChoices: [],
    parentLocked: false,
    typeLocked: false,
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
    await this.prepare()
    this.setData({ ready: true })
  },

  async prepare() {
    try {
      this.allTags = await getAllTags()
    } catch (err) {
      console.error(err)
      this.allTags = this.allTags || []
      wx.showToast({ title: '标签暂时没有拿到', icon: 'none' })
    }
    if (this.tagId && !this.hydrated) {
      await this.loadTag()
      this.hydrated = true
    }
    this.refreshParents()
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
        parentId: tagParentId(tag),
        archived: !!tag.archived,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '标签没有找到', icon: 'none' })
    }
  },

  refreshParents() {
    const locked = !!(this.tagId && hasChildren(this.allTags, this.tagId))
    const parentId = locked ? '' : (this.data.parentId || '')
    const choices = parentChoices(this.allTags, {
      type: parentId ? (this.allTags.find((tag) => tag._id === parentId) || {}).type || this.data.type : this.data.type,
      selfId: this.tagId,
      currentParentId: parentId,
    })
    const stillThere = !parentId || choices.some((tag) => tag._id === parentId)
    this.setData({
      parentLocked: locked,
      parentId: stillThere ? parentId : '',
      parentChoices: locked ? [] : choices,
      typeLocked: locked || !!parentId,
    })
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
    if (this.data.typeLocked) return
    const type = event.currentTarget.dataset.type
    if (type === this.data.type) return
    this.setData({ type })
    this.refreshParents()
  },

  onParent(event) {
    if (this.data.parentLocked) return
    const parentId = event.currentTarget.dataset.id === 'none' ? '' : event.currentTarget.dataset.id
    const parent = (this.allTags || []).find((tag) => tag._id === parentId)
    const patch = { parentId }
    if (parent) {
      patch.type = parent.type
      if (!this.tagId) {
        patch.icon = parent.icon || this.data.icon
        patch.color = parent.color || this.data.color
      }
    }
    this.setData(patch)
    this.refreshParents()
  },

  async onSave() {
    const name = (this.data.name || '').trim().slice(0, 8)
    if (!name || this.saving) {
      if (!name) wx.showToast({ title: '请填写名称', icon: 'none' })
      return
    }
    let tags = this.allTags || []
    try {
      tags = await getAllTags()
      this.allTags = tags
    } catch (err) {
      console.error(err)
    }
    const parentId = this.data.parentLocked ? '' : (this.data.parentId || '')
    const type = parentId
      ? ((tags.find((tag) => tag._id === parentId) || {}).type || this.data.type)
      : this.data.type
    const problem = validateTag(tags, {
      id: this.tagId,
      name,
      type,
      parentId,
    })
    if (problem) {
      wx.showToast({ title: problem, icon: 'none' })
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
        type,
        parentId,
        updatedAt: db.serverDate(),
      }
      if (this.tagId) {
        const current = tags.find((tag) => tag._id === this.tagId)
        const moved = tagParentId(current) !== parentId
        if (moved) {
          payload.sort = tags
            .filter((tag) => tag.type === type && tagParentId(tag) === parentId)
            .reduce((max, tag) => Math.max(max, tag.sort || 0), -1) + 1
        }
        await db.collection('tags').doc(this.tagId).update({ data: payload })
      } else {
        const sort = tags
          .filter((tag) => tag.type === type && tagParentId(tag) === parentId)
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

  onToggleDisabled() {
    if (this.data.archived) {
      this.updateArchived(false)
      return
    }
    const withChildren = hasChildren(this.allTags, this.tagId)
    wx.showModal({
      title: '停用这个标签？',
      content: withChildren
        ? '停用后不能再用来记账，它的下级也不会出现在记一笔里。已经记过的账单不受影响。'
        : '停用后不能再用来记账。已经记过的账单不受影响。',
      confirmColor: '#1F2A37',
      success: (res) => {
        if (res.confirm) this.updateArchived(true)
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
