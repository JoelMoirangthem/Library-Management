// Pure helpers that turn official LGD names into the names people use. Unit-tested in clean.test.mjs.

/** "KAKO" -> "Kako". Names already in mixed case are left alone. */
export function titleCaseIfShouting(s) {
  if (!/[A-Z]/.test(s) || /[a-z]/.test(s)) return s
  return s.toLowerCase().replace(/(^|[\s(\-./])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
}

/** "Jammu And Kashmir" -> "Jammu and Kashmir". For state and district names. */
export function lowerJoiningWords(s) {
  return s.replace(/ (And|Of) /g, (m) => m.toLowerCase())
}

// Words that name the council, not the town. Removed from the start or end of a town name.
const LEADING = /^(municipal (council|corporation|committee)|city corporation|nagar palika),?\s+/i
const TRAILING =
  /\s+(municipal corporation|municipal council|municipal committee|municipal board|municipality|nagar panchayat|nagar palika parishad|nagar palika|nagar parishad|nagar nigam|city corporation|town panchayat|town council|town committee|notified area committee|corporation|committee|council|tc|mb|np)$/i
// Bracketed tags that are council types, not part of the name. "(B)" and "(Bk)" mean Budruk and stay.
const TAGS = /\(\s*(gba|m\.? ?corp\.?|np|m|mc|cmc|tmc)\s*\)/gi

/** "Medininagar (Daltonganj) Municipal Corporation" -> "Medininagar (Daltonganj)". */
export function cleanTownName(raw) {
  let s = titleCaseIfShouting(raw.trim().replace(/\s+/g, ' '))
  s = s.replace(/\.{2,}/g, ' ').replace(TAGS, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 2; i++) s = s.replace(LEADING, '').replace(TRAILING, '')
  s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/(\S)\(/g, '$1 (')
  return s.replace(/\s+/g, ' ').trim().replace(/[,.-]+$/, '')
}

/** Escapes a value for a SQL string literal. */
export const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`

/** Minimal CSV reader: commas, double-quoted fields, doubled quotes inside quotes, CRLF. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  const keys = head.map((h) => h.replace(/^\uFEFF/, '').trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
