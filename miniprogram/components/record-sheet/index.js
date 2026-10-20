const { applyKey, rawToFen, formatTyping } = require('../../utils/money')
const { tint } = require('../../utils/constants')
const { getAllTags } = require('../../utils/query')
const { formatDateInput, parseDateInput, parseDateTime, formatShortDay } = require('../../utils/time')

Component({
  properties: {
    backfill: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    on: false,
    type: 'expense',
    raw: '',
    amountText: '0.00',
    tagId: '',
    tags: [],
    emptyTags: false,
    note: '',
    date: '',
    today: '',
    time: '12:00',
    dateLabel: '今天',
    canSave: false,
  },

  lifetimes: {
    attached() {
      const today = formatDateInput(new Date())
      this.setData({ date: today, today, time: '12:00', dateLabel: '今天' })
      this.setTabBarHidden(true)
      this.prepare()
      setTimeout(() => this.setData({ on: true }), 30)
    },
    detached() {
      this.setTabBarHidden(false)
    },
  },

  methods: {
    noop() {},

    setTabBarHidden(hidden) {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (!page || typeof page.getTabBar !== 'function') return
      const tabBar = page.getTabBar()
      if (tabBar) tabBar.setData({ hidden })
    },

    async prepare() {
      try {
        this.allTags = await getAllTags()
      } catch (err) {
        console.error(err)
        this.allTags = []
        wx.showToast({ title: '标签暂时没有拿到', icon: 'none' })
      }
      this.refreshTags()
    },

    refreshTags() {
      const tags = (this.allTags || [])
        .filter((tag) => tag.type === this.data.type && !tag.archived)
        .map((tag) => ({ ...tag, tint: tint(tag.color) }))
      const tagId = tags.some((tag) => tag._id === this.data.tagId) ? this.data.tagId : ''
      this.setData({
        tags,
        emptyTags: tags.length === 0,
        tagId,
        canSave: rawToFen(this.data.raw) > 0 && !!tagId,
      })
    },

    switchType(event) {
      const type = event.currentTarget.dataset.type
      if (type === this.data.type) return
      this.data.type = type
      this.setData({ type })
      this.refreshTags()
    },

    pickTag(event) {
      const tagId = event.currentTarget.dataset.id
      this.setData({
        tagId,
        canSave: rawToFen(this.data.raw) > 0 && !!tagId,
      })
    },

    onDate(event) {
      const date = event.detail.value
      this.setData({ date, dateLabel: formatShortDay(parseDateInput(date)) })
    },

    onTime(event) {
      this.setData({ time: event.detail.value || '12:00' })
    },

    occurredAt() {
      if (this.properties.backfill) return parseDateTime(this.data.date, this.data.time)
      return parseDateInput(this.data.date)
    },

    onNote(event) {
      this.setData({ note: event.detail.value.slice(0, 40) })
    },

    onKey(event) {
      const raw = applyKey(this.data.raw, event.currentTarget.dataset.key)
      this.setData({
        raw,
        amountText: formatTyping(raw),
        canSave: rawToFen(raw) > 0 && !!this.data.tagId,
      })
    },

    requestClose() {
      if (this.closing) return
      this.closing = true
      this.setData({ on: false })
      setTimeout(() => this.triggerEvent('close'), 240)
    },

    async onSave() {
      if (!this.data.canSave || this.saving || this.closing) return
      const tag = (this.data.tags || []).find((item) => item._id === this.data.tagId)
      if (!tag) return
      this.saving = true
      wx.showLoading({ title: '保存中', mask: true })
      let failed = false
      try {
        const db = wx.cloud.database()
        await db.collection('records').add({
          data: {
            amount: rawToFen(this.data.raw),
            type: this.data.type,
            tagId: tag._id,
            tagName: tag.name,
            tagColor: tag.color,
            tagIcon: tag.icon,
            note: (this.data.note || '').trim().slice(0, 40),
            occurredAt: this.occurredAt(),
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
          },
        })
      } catch (err) {
        console.error(err)
        failed = true
      } finally {
        wx.hideLoading()
        this.saving = false
      }
      if (failed) {
        wx.showToast({ title: '没有保存成功', icon: 'none' })
        return
      }
      this.closing = true
      this.setData({ on: false })
      setTimeout(() => this.triggerEvent('saved'), 240)
    },

    goTags() {
      wx.navigateTo({ url: '/pages/tags/index' })
    },
  },
})
