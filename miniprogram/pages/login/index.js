const { loadUserOnce, initCloudData, markEntered } = require('../../utils/session')

Page({
  data: {
    ready: false,
    mode: '',
    avatarUrl: '',
    nickName: '',
    submitting: false,
  },

  onLoad() {
    const app = getApp()
    if (app.globalData.loggedOut) {
      this.setData({ ready: true, mode: 'enter' })
      return
    }
    loadUserOnce().then((user) => {
      if (getApp().globalData.loggedOut) {
        this.setData({ ready: true, mode: 'enter' })
        return
      }
      if (user) {
        wx.switchTab({ url: '/pages/bill/index' })
        return
      }
      this.setData({ ready: true, mode: 'auth' })
    }).catch(() => {
      this.setData({ ready: true, mode: 'auth' })
    })
  },

  onChooseAvatar(event) {
    this.setData({ avatarUrl: event.detail.avatarUrl })
  },

  onNick(event) {
    this.setData({ nickName: event.detail.value })
  },

  onEnter() {
    markEntered()
    wx.switchTab({ url: '/pages/bill/index' })
  },

  async onAuth(event) {
    if (this.data.submitting) return
    const nickName = (event.detail.value.nickName || this.data.nickName || '').trim()
    if (!this.data.avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ submitting: true, nickName })
    wx.showLoading({ title: '正在进入', mask: true })
    let toast = ''
    try {
      await initCloudData()
      const existing = await wx.cloud.database().collection('users').limit(1).get()
      if (existing.data[0]) {
        markEntered(existing.data[0])
        wx.switchTab({ url: '/pages/bill/index' })
      } else {
        const file = await wx.cloud.uploadFile({
          cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
          filePath: this.data.avatarUrl,
        })
        const db = wx.cloud.database()
        const now = db.serverDate()
        const added = await db.collection('users').add({
          data: {
            nickName: nickName.slice(0, 20),
            avatarFileId: file.fileID,
            createdAt: now,
            updatedAt: now,
          },
        })
        markEntered({
          _id: added._id,
          nickName: nickName.slice(0, 20),
          avatarFileId: file.fileID,
        })
        wx.switchTab({ url: '/pages/bill/index' })
      }
    } catch (err) {
      console.error(err)
      toast = failText(err)
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
    if (toast) wx.showToast({ title: toast, icon: 'none' })
  },
})

function failText(err) {
  const text = `${(err && err.errCode) || ''} ${(err && (err.errMsg || err.message)) || ''}`
  if (text.includes('502005') || text.includes('DATABASE_COLLECTION_NOT_EXIST') || text.includes('Db or Table not exist')) {
    return '请先创建云数据库'
  }
  return '登录没有完成，请检查云开发'
}
