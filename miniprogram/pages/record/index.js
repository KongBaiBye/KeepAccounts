const { applyKey, rawToFen, fenToRaw, formatTyping } = require('../../utils/money')
const { tint } = require('../../utils/constants')
const { guard } = require('../../utils/session')
const { getAllTags } = require('../../utils/query')
const { toDate, formatDateInput, parseDateInput, formatShortDay } = require('../../utils/time')
const { chooseParent, selectionModel, selectionReady } = require('../../utils/tags')

Page({
  data: {
    ready: false,
    id: '',
    type: 'expense',
    raw: '',
    amountText: '0.00',
    tagId: '',
    parentTagId: '',
    parents: [],
    children: [],
    needsChild: false,
    showChildHint: false,
    emptyTags: false,
    note: '',
    date: '',
    dateLabel: '今天',
    canSave: false,
  },

  onLoad(options) {
    this.recordId = options.id || ''
    const today = formatDateInput(new Date())
    this.setData({ id: this.recordId, date: today, dateLabel: '今天' })
    if (this.recordId) wx.setNavigationBarTitle({ title: '编辑账单' })
  },

  async onShow() {
    const user = await guard()
    if (!user) return
    await this.prepare()
  },

  async prepare() {
    try {
      this.allTags = await getAllTags()
    } catch (err) {
      console.error(err)
      this.allTags = []
      wx.showToast({ title: '标签暂时没有拿到', icon: 'none' })
    }
    if (this.recordId && !this.hydrated) {
      await this.loadRecord()
      this.hydrated = true
    }
    this.refreshTags()
    this.setData({ ready: true })
  },

  async loadRecord() {
    try {
      const res = await wx.cloud.database().collection('records').doc(this.recordId).get()
      const record = res.data
      const raw = fenToRaw(record.amount)
      const date = formatDateInput(toDate(record.occurredAt))
      this.keepTagId = record.tagId || ''
      this.setData({
        type: record.type,
        raw,
        amountText: formatTyping(raw),
        tagId: record.tagId,
        note: record.note || '',
        date,
        dateLabel: formatShortDay(parseDateInput(date)),
        canSave: rawToFen(raw) > 0 && !!record.tagId,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '这笔账单没有找到', icon: 'none' })
    }
  },

  paint(tags) {
    return (tags || []).map((tag) => ({ ...tag, tint: tint(tag.color) }))
  },

  applyModel(model) {
    const ready = selectionReady(model, this.keepTagId || '')
    this.setData({
      type: this.data.type,
      parents: this.paint(model.parents),
      children: this.paint(model.children),
      parentTagId: model.parentTagId,
      tagId: model.tagId,
      needsChild: model.needsChild,
      showChildHint: model.needsChild && !ready,
      emptyTags: model.parents.length === 0,
      canSave: rawToFen(this.data.raw) > 0 && ready,
    })
  },

  refreshTags() {
    this.applyModel(selectionModel(this.allTags, {
      type: this.data.type,
      parentTagId: this.data.parentTagId,
      tagId: this.data.tagId,
      keepId: this.keepTagId || '',
    }))
  },

  switchType(event) {
    const type = event.currentTarget.dataset.type
    if (type === this.data.type) return
    this.data.type = type
    this.data.parentTagId = ''
    this.data.tagId = ''
    this.refreshTags()
  },

  pickParent(event) {
    this.applyModel(chooseParent(this.allTags, {
      type: this.data.type,
      parentId: event.currentTarget.dataset.id,
      tagId: this.data.tagId,
      keepId: this.keepTagId || '',
    }))
  },

  pickChild(event) {
    const tagId = event.currentTarget.dataset.id
    const ready = selectionReady({
      tagId,
      parentTagId: this.data.parentTagId,
      needsChild: this.data.needsChild,
    }, this.keepTagId || '')
    this.setData({
      tagId,
      showChildHint: this.data.needsChild && !ready,
      canSave: rawToFen(this.data.raw) > 0 && ready,
    })
  },

  onDate(event) {
    const date = event.detail.value
    this.setData({ date, dateLabel: formatShortDay(parseDateInput(date)) })
  },

  onNote(event) {
    this.setData({ note: event.detail.value.slice(0, 40) })
  },

  onKey(event) {
    const raw = applyKey(this.data.raw, event.currentTarget.dataset.key)
    this.setData({
      raw,
      amountText: formatTyping(raw),
      canSave: rawToFen(raw) > 0 && selectionReady(this.data, this.keepTagId || ''),
    })
  },

  async onSave() {
    if (!this.data.canSave || this.saving) return
    const tag = (this.allTags || []).find((item) => item._id === this.data.tagId)
    if (!tag) return
    this.saving = true
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const db = wx.cloud.database()
      const payload = {
        amount: rawToFen(this.data.raw),
        type: this.data.type,
        tagId: tag._id,
        tagName: tag.name,
        tagColor: tag.color,
        tagIcon: tag.icon,
        note: (this.data.note || '').trim().slice(0, 40),
        occurredAt: parseDateInput(this.data.date),
        updatedAt: db.serverDate(),
      }
      if (this.recordId) {
        await db.collection('records').doc(this.recordId).update({ data: payload })
      } else {
        payload.createdAt = db.serverDate()
        await db.collection('records').add({ data: payload })
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

  onDelete() {
    wx.showModal({
      title: '删除这笔账单？',
      content: '删除后不能恢复',
      confirmColor: '#E85D4C',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await wx.cloud.database().collection('records').doc(this.recordId).remove()
          wx.navigateBack()
        } catch (err) {
          console.error(err)
          wx.showToast({ title: '没有删除成功', icon: 'none' })
        }
      },
    })
  },

  goTags() {
    wx.navigateTo({ url: '/pages/tags/index' })
  },
})
