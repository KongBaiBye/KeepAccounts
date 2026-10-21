const { toDate } = require('./time')
const { compareRecordsDesc } = require('./records')
const { exportTagName, indexTags, tagParentId } = require('./tags')

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let crc = n
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[n] = crc >>> 0
  }
  return table
})()

function pad(number) {
  return String(number).padStart(2, '0')
}

function formatLocalDateTime(value) {
  if (!value) return ''
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatExportStamp(date) {
  const value = toDate(date)
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}`
}

function typeLabel(type) {
  return type === 'income' ? '收入' : '支出'
}

function signedYuan(type, fen) {
  const abs = Math.abs(Math.round(Number(fen) || 0))
  const yuan = `${Math.floor(abs / 100)}.${pad(abs % 100)}`
  return type === 'income' ? yuan : `-${yuan}`
}

function mapRecord(record, tags) {
  return {
    id: record._id || '',
    amount: Math.round(Number(record.amount) || 0),
    type: record.type === 'income' ? 'income' : 'expense',
    tagId: record.tagId || '',
    tagName: exportTagName(record, tags),
    tagColor: record.tagColor || '',
    tagIcon: record.tagIcon || '',
    note: record.note || '',
    occurredAt: formatLocalDateTime(record.occurredAt),
    createdAt: formatLocalDateTime(record.createdAt),
    updatedAt: formatLocalDateTime(record.updatedAt),
  }
}

function mapTag(tag, byId) {
  const parent = byId[tagParentId(tag)]
  return {
    id: tag._id || '',
    name: tag.name || '',
    parentId: tagParentId(tag),
    parentName: parent ? parent.name : '',
    icon: tag.icon || '',
    color: tag.color || '',
    type: tag.type === 'income' ? 'income' : 'expense',
    sort: Number(tag.sort) || 0,
    archived: !!tag.archived,
    createdAt: formatLocalDateTime(tag.createdAt),
    updatedAt: formatLocalDateTime(tag.updatedAt),
  }
}

function compareTags(left, right) {
  if (left.type !== right.type) return left.type === 'expense' ? -1 : 1
  if (left.archived !== right.archived) return left.archived ? 1 : -1
  return left.sort - right.sort
}

function buildExport({ records = [], tags = [], settings = null, exportedAt = new Date() } = {}) {
  const exported = toDate(exportedAt)
  const byId = indexTags(tags)
  const sortedRecords = records.slice().sort(compareRecordsDesc)
  return {
    version: 1,
    exportedAt: formatLocalDateTime(exported),
    amountUnit: 'fen',
    settings: {
      cycleStartDay: settings && settings.cycleStartDay ? Number(settings.cycleStartDay) : null,
    },
    tags: tags.map((tag) => mapTag(tag, byId)).sort(compareTags),
    records: sortedRecords.map((record) => mapRecord(record, byId)),
  }
}

function toJson(doc) {
  return JSON.stringify(doc, null, 2)
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnName(index) {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function cellXml(ref, cell) {
  if (cell.type === 'number') {
    const style = cell.plain ? '' : ' s="1"'
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`
  }
  const style = cell.header ? ' s="2"' : ''
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
}

function worksheetXml(rows, widths) {
  const cols = widths.map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  )).join('')
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => cellXml(`${columnName(columnIndex)}${rowIndex + 1}`, cell)).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
}

function textCell(value, header) {
  return { type: 'text', value: value == null ? '' : String(value), header: !!header }
}

function headerRow(titles) {
  return titles.map((title) => textCell(title, true))
}

function billSheet(doc) {
  const rows = [headerRow(['日期', '类型', '分类', '金额(元)', '备注'])]
  doc.records.forEach((record) => {
    rows.push([
      textCell(record.occurredAt),
      textCell(typeLabel(record.type)),
      textCell(record.tagName),
      { type: 'number', value: signedYuan(record.type, record.amount) },
      textCell(record.note),
    ])
  })
  return { name: '账单', rows, widths: [22, 10, 22, 14, 28] }
}

function tagSheet(doc) {
  const rows = [headerRow(['名称', '上级', '类型', '颜色', '图标', '排序', '已归档'])]
  doc.tags.forEach((tag) => {
    rows.push([
      textCell(tag.name),
      textCell(tag.parentName || ''),
      textCell(typeLabel(tag.type)),
      textCell(tag.color),
      textCell(tag.icon),
      { type: 'number', value: String(tag.sort || 0), plain: true },
      textCell(tag.archived ? '是' : '否'),
    ])
  })
  return { name: '标签', rows, widths: [14, 14, 10, 12, 12, 10, 12] }
}

function settingSheet(doc) {
  return {
    name: '设置',
    widths: [16, 24],
    rows: [
      headerRow(['项目', '值']),
      [textCell('每月起始日'), textCell(doc.settings.cycleStartDay || '未设置')],
      [textCell('导出时间'), textCell(doc.exportedAt)],
      [textCell('金额单位'), textCell('账单表中的金额单位是元，支出为负，收入为正')],
    ],
  }
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`

function workbookXml(sheets) {
  const body = sheets.map((sheet, index) => (
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${body}</sheets></workbook>`
}

function workbookRels(sheets) {
  const body = sheets.map((sheet, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('')
  const styleId = sheets.length + 1
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}<Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
}

function contentTypes(sheets) {
  const sheetsXml = sheets.map((sheet, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetsXml}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
}

function encodeUtf8(text) {
  const input = String(text)
  const bytes = []
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        i += 1
      }
    }
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return Uint8Array.from(bytes)
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value) {
  const bytes = new Uint8Array(2)
  bytes[0] = value & 0xff
  bytes[1] = (value >>> 8) & 0xff
  return bytes
}

function u32(value) {
  const bytes = new Uint8Array(4)
  bytes[0] = value & 0xff
  bytes[1] = (value >>> 8) & 0xff
  bytes[2] = (value >>> 16) & 0xff
  bytes[3] = (value >>> 24) & 0xff
  return bytes
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach((part) => {
    out.set(part, offset)
    offset += part.length
  })
  return out
}

function parseExportDate(value) {
  const matched = typeof value === 'string'
    && value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!matched) return toDate(value)
  return new Date(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
    Number(matched[4]),
    Number(matched[5]),
    Number(matched[6]),
  )
}

function dosDateTime(date) {
  const value = parseExportDate(date)
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2)
  const day = ((Math.max(value.getFullYear(), 1980) - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate()
  return { time, day }
}

function buildZip(files, date) {
  const { time, day } = dosDateTime(date)
  const locals = []
  const centrals = []
  let offset = 0
  files.forEach((file) => {
    const name = encodeUtf8(file.name)
    const data = encodeUtf8(file.text)
    const crc = crc32(data)
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ])
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(day),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  })
  const centralDir = concat(centrals)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  return concat(locals.concat([centralDir, end]))
}

function bytesToBase64(bytes) {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0
    const triple = (a << 16) | (b << 8) | c
    out += table[(triple >>> 18) & 63]
    out += table[(triple >>> 12) & 63]
    out += i + 1 < bytes.length ? table[(triple >>> 6) & 63] : '='
    out += i + 2 < bytes.length ? table[triple & 63] : '='
  }
  return out
}

function buildXlsx(doc) {
  const sheets = [billSheet(doc), tagSheet(doc), settingSheet(doc)]
  const files = [
    { name: '[Content_Types].xml', text: contentTypes(sheets) },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: 'xl/workbook.xml', text: workbookXml(sheets) },
    { name: 'xl/_rels/workbook.xml.rels', text: workbookRels(sheets) },
    { name: 'xl/styles.xml', text: STYLES_XML },
  ]
  sheets.forEach((sheet, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      text: worksheetXml(sheet.rows, sheet.widths),
    })
  })
  return buildZip(files, doc.exportedAt || new Date())
}

module.exports = {
  buildExport,
  toJson,
  buildXlsx,
  bytesToBase64,
  formatExportStamp,
}
