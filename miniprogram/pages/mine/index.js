const { guard, markLoggedOut, markEntered } = require('../../utils/session')
const { buildExport, toJson, buildXlsx, bytesToBase64, formatExportStamp } = require('../../utils/export')

const PAGE_SIZE = 20
const MAX_ROWS = 5000

function isMissingCollection(err) {
  const text = `${err && err.errCode} ${err && (err.errMsg || err.message)}`
  return text.includes('502005') || text.includes('not exist')
}

async function fetchAll(name, orderField) {
  const collection = wx.cloud.database().collection(name)
  const all = []
  let useOrder = !!orderField
  let skip = 0
  while (skip < MAX_ROWS) {
    try {
      let query = collection
      if (useOrder) query = query.orderBy(orderField, 'desc')
      const res = await query.skip(skip).limit(PAGE_SIZE).get()
      const batch = res.data || []
      all.push(...batch)
      if (batch.length < PAGE_SIZE) return { data: all, truncated: false }
      skip += PAGE_SIZE
    } catch (err) {
      if (useOrder && skip === 0) {
        useOrder = false
        continue
      }
      throw err
    }
  }
  return { data: all, truncated: true }
}

async function fetchAllOrEmpty(name, orderField) {
  try {
    return await fetchAll(name, orderField)
  } catch (err) {
    if (isMissingCollection(err)) return { data: [], truncated: false }
    throw err
  }
}

function writeFile(filePath, data, encoding) {
  return new Promise((resolve, reject) => {
    const payload = { filePath, data, success: resolve, fail: reject }
    if (encoding) payload.encoding = encoding
    wx.getFileSystemManager().writeFile(payload)
  })
}

Page({
  data: {
    ready: false,
    nickName: '',
    avatarUrl: '',
    dirty: false,
    saving: false,
    backfillOpen: false,
    exportOpen: false,
    exportReady: false,
    exportName: '',
    exportSummary: '',
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) {
      const data = { selected: 2 }
      if (this.data.exportOpen) data.hidden = true
      tabBar.setData(data)
    }
    this.bootstrap()
  },

  onHide() {
    if (this.data.exportOpen && !this.data.backfillOpen) this.setTabBarHidden(false)
  },

  setTabBarHidden(hidden) {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tabBar) tabBar.setData({ hidden })
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

  openExport() {
    this.exportFile = null
    this.setTabBarHidden(true)
    this.setData({
      exportOpen: true,
      exportReady: false,
      exportName: '',
      exportSummary: '',
    })
  },

  closeExport() {
    this.setTabBarHidden(false)
    this.setData({ exportOpen: false })
  },

  noop() {},

  async onExport(event) {
    if (this.exporting) return
    const format = event.currentTarget.dataset.format === 'excel' ? 'excel' : 'json'
    this.exporting = true
    wx.showLoading({ title: '正在导出', mask: true })
    try {
      const [recordsResult, tagsResult, settingsResult] = await Promise.all([
        fetchAllOrEmpty('records', 'occurredAt'),
        fetchAllOrEmpty('tags'),
        fetchAllOrEmpty('settings'),
      ])
      const exportedAt = new Date()
      const doc = buildExport({
        records: recordsResult.data,
        tags: tagsResult.data,
        settings: settingsResult.data[0] || null,
        exportedAt,
      })
      const excel = format === 'excel'
      const fileName = `记账-${formatExportStamp(exportedAt)}.${excel ? 'xlsx' : 'json'}`
      const filePath = `${wx.env.USER_DATA_PATH}/keepaccounts-export.${excel ? 'xlsx' : 'json'}`
      if (excel) {
        await writeFile(filePath, bytesToBase64(buildXlsx(doc)), 'base64')
      } else {
        await writeFile(filePath, toJson(doc), 'utf8')
      }
      const summary = recordsResult.truncated
        ? `账单超过 ${MAX_ROWS} 笔，这次导出了 ${doc.records.length} 笔，另有 ${doc.tags.length} 个标签`
        : `${doc.records.length} 笔账单，${doc.tags.length} 个标签`
      this.exportFile = { filePath, fileName }
      wx.hideLoading()
      this.setData({
        exportReady: true,
        exportName: fileName,
        exportSummary: summary,
      })
    } catch (err) {
      console.error(err)
      wx.hideLoading()
      wx.showToast({ title: '没有导出成功', icon: 'none' })
    } finally {
      this.exporting = false
    }
  },

  shareExport() {
    if (!this.exportFile) return
    wx.shareFileMessage({
      filePath: this.exportFile.filePath,
      fileName: this.exportFile.fileName,
      fail: (err) => {
        const message = `${err && err.errMsg}`
        if (message.includes('cancel')) return
        console.error(err)
        wx.showToast({ title: '没有发送成功', icon: 'none' })
      },
    })
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
