const { guard, markLoggedOut, markEntered } = require('../../utils/session')

Page({
  data: {
    ready: false,
    nickName: '',
    avatarUrl: '',
    dirty: false,
    saving: false,
    backfillOpen: false,
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) tabBar.setData({ selected: 2 })
    this.bootstrap()
  },

  async bootstrap() {
    const user = await guard()
    if (!user) return
    if (this.data.dirty) {
      this.setData({ ready: true })
      return
    }
    this.savedNick = user.nickName || ''
    this.savedAvatar = user.avatarFileId || ''
    this.setData({
      ready: true,
      nickName: this.savedNick,
      avatarUrl: this.savedAvatar,
    })
  },

  onChooseAvatar(event) {
    this.setData({ avatarUrl: event.detail.avatarUrl, dirty: true })
  },

  onNick(event) {
    const nickName = event.detail.value
    this.setData({
      nickName,
      dirty: nickName.trim() !== this.savedNick || this.data.avatarUrl !== this.savedAvatar,
    })
  },

  async onSave(event) {
    if (this.data.saving) return
    const nickName = (event.detail.value.nickName || this.data.nickName || '').trim().slice(0, 20)
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中', mask: true })
    try {
      let avatarFileId = this.savedAvatar
      if (this.data.avatarUrl && this.data.avatarUrl !== this.savedAvatar) {
        const file = await wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
          filePath: this.data.avatarUrl,
        })
        avatarFileId = file.fileID
      }
      const db = wx.cloud.database()
      const user = getApp().globalData.user
      await db.collection('users').doc(user._id).update({
        data: {
          nickName,
          avatarFileId,
          updatedAt: db.serverDate(),
        },
      })
      const next = { ...user, nickName, avatarFileId }
      markEntered(next)
      this.savedNick = nickName
      this.savedAvatar = avatarFileId
      this.setData({
        nickName,
        avatarUrl: avatarFileId,
        dirty: false,
      })
      wx.showToast({ title: '已保存', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '没有保存成功', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  },

  openBackfill() {
    this.setData({ backfillOpen: true })
  },

  closeBackfill() {
    this.setData({ backfillOpen: false })
  },

  goTags() {
    wx.navigateTo({ url: '/pages/tags/index' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录？',
      content: '账单仍留在云端。下次打开会自动进入。',
      confirmColor: '#1F2A37',
      success: (res) => {
        if (!res.confirm) return
        markLoggedOut()
        wx.reLaunch({ url: '/pages/login/index' })
      },
    })
  },
})
