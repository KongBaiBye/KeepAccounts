const COLORS = [
  '#E7A090',
  '#E8C49A',
  '#D4C48A',
  '#9EBEA6',
  '#8FB8B0',
  '#93AEC9',
  '#B0A4C8',
  '#C7A3B0',
]

const ICONS = [
  { key: 'meal', label: '餐饮' },
  { key: 'traffic', label: '交通' },
  { key: 'shopping', label: '购物' },
  { key: 'home', label: '居住' },
  { key: 'fun', label: '娱乐' },
  { key: 'medical', label: '医疗' },
  { key: 'salary', label: '工资' },
  { key: 'more', label: '其他' },
  { key: 'coffee', label: '饮品' },
  { key: 'gift', label: '礼物' },
  { key: 'book', label: '学习' },
  { key: 'pet', label: '宠物' },
  { key: 'sport', label: '运动' },
  { key: 'travel', label: '旅行' },
  { key: 'phone', label: '通讯' },
  { key: 'baby', label: '亲子' },
]

function tint(hex) {
  const value = parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  const mix = (channel) => Math.round(channel * 0.18 + 255 * 0.82)
  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`
}

module.exports = {
  COLORS,
  ICONS,
  tint,
}
