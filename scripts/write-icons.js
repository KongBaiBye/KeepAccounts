const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '../miniprogram/images/tags')
fs.mkdirSync(dir, { recursive: true })

const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1F2A37" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
const foot = '</svg>'

const icons = {
  meal: '<path d="M4 10h16"/><path d="M6 10c.4 5 2.6 8 6 8s5.6-3 6-8"/><path d="M9 6c.4 1.6.8 1.6 1.2 0"/><path d="M13.2 6c.4 1.6.8 1.6 1.2 0"/>',
  traffic: '<path d="M4 15h16"/><path d="M6.5 15l1.8-5h7.4l1.8 5"/><path d="M7 18.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/><path d="M17 18.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/>',
  shopping: '<path d="M6.5 8h11l-.8 11H7.3L6.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M7 10.5V20h10v-9.5"/>',
  fun: '<path d="M9 17V6l10-2v11"/><circle cx="7.2" cy="17" r="1.8"/><circle cx="17.2" cy="15" r="1.8"/>',
  medical: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  salary: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9"/><path d="M9.5 9.2c.6-.9 4.4-.9 5 .4.6 1.2-.6 1.8-2.5 2.1S9.2 13 9.8 14.4c.6 1.2 3.8 1.5 4.9.2"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="#1F2A37" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="#1F2A37" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="#1F2A37" stroke="none"/>',
  coffee: '<path d="M6 8h10v5a4 4 0 0 1-4 4H9a3 3 0 0 1-3-4V8z"/><path d="M16 9h1.6a2.2 2.2 0 0 1 0 4.4H16"/><path d="M9 4.5c.2 1 .6 1.2.6 2"/><path d="M12 4.5c.2 1 .6 1.2.6 2"/>',
  gift: '<path d="M4 11h16v8H4z"/><path d="M4 8h16v3H4z"/><path d="M12 8v11"/><path d="M12 8c-1.6 0-3.2-1.6-2-3S12 6.2 12 8z"/><path d="M12 8c1.6 0 3.2-1.6 2-3S12 6.2 12 8z"/>',
  book: '<path d="M5 5h5.5A2.5 2.5 0 0 1 13 7.5V19H8a3 3 0 0 1-3-3V5z"/><path d="M13 7.5h6V19h-6"/>',
  pet: '<circle cx="7" cy="8" r="1.6"/><circle cx="12" cy="6.2" r="1.6"/><circle cx="17" cy="8" r="1.6"/><circle cx="9" cy="12.2" r="1.5"/><path d="M9.2 14.2c.8 3.2 4.8 3.2 5.6 0 .4-1.6-1-3-2.8-3s-3.2 1.4-2.8 3z"/>',
  sport: '<circle cx="12" cy="12" r="8"/><path d="M12 4c2.2 2.4 2.2 13.2 0 16"/><path d="M4 12h16"/>',
  travel: '<path d="M3 12.5 21 6l-7.2 14-1.6-6.2L3 12.5z"/>',
  phone: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2"/>',
  baby: '<circle cx="12" cy="12" r="8"/><path d="M9 11.2h.01M15 11.2h.01"/><path d="M9.2 14.2c.8 1.2 4.8 1.2 5.6 0"/><path d="M8.2 7.2c.8-1.6 2.4-1.6 3.2.2"/><path d="M15.8 7.2c-.8-1.6-2.4-1.6-3.2.2"/>',
}

Object.keys(icons).forEach((name) => {
  fs.writeFileSync(path.join(dir, `${name}.svg`), `${head}${icons[name]}${foot}`)
})

const avatarDir = path.join(__dirname, '../miniprogram/images')
fs.writeFileSync(
  path.join(avatarDir, 'avatar-placeholder.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#E7E1D8"/><circle cx="40" cy="32" r="12" fill="#F6F4F1"/><path d="M18 68c5-14 14-20 22-20s17 6 22 20" fill="#F6F4F1"/></svg>'
)
