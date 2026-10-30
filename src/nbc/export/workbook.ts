import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { calculate } from '../progress'
import { weightValues } from './weight-values'
import { addDays, appliedEntries, submissionStatus, weekStart } from '../submissions'
import { handlers } from '../types'
import type { NbcActivity, NbcSubmission } from '../types'

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024

// Client reports cover Sunday–Saturday; submission keys remain Monday-based.
export function reportingBlock(week: string) {
  if (weekStart(week) !== week) throw new Error('Choose a valid reporting week.')
  const format = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  return `${format(addDays(week, -1))} to ${format(addDays(week, 5))}`
}
export const reportFilename = (week: string, projectId = 'nbc-bp03') => `${projectId.toUpperCase()}-Progress Tracking by BOQ-(${reportingBlock(week)}).xlsx`

function xml(data: Uint8Array | undefined) {
  if (!data) throw new Error('The Excel template is missing a required workbook part.')
  const doc = new DOMParser().parseFromString(strFromU8(data), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The Excel template contains invalid worksheet data.')
  return doc
}
const elements = (node: Document | Element, tag: string) => [...node.getElementsByTagNameNS(NS, tag)]
const bytes = (doc: Document) => strToU8(new XMLSerializer().serializeToString(doc))

export function reportValues(activities: NbcActivity[], submissions: NbcSubmission[], week: string) {
  if (weekStart(week) !== week) throw new Error('Choose a valid reporting week.')
  const values = new Map(activities.map(a => [a.id, a.progress]))
  const ordered = [...submissions].filter(s => s.projectId === activities[0]?.projectId).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? '') || b.id.localeCompare(a.id))
  for (const s of ordered) if (s.weekStart > week) for (const e of [...appliedEntries(s)].reverse()) values.set(e.activityId, e.previous)
  const previous = new Map(values)
  for (const s of ordered) if (s.weekStart === week) for (const e of [...appliedEntries(s)].reverse()) previous.set(e.activityId, e.previous)
  return { current: calculate(activities, values), previous: calculate(activities, previous) }
}

export const confirmedCount = (activities: NbcActivity[], submissions: NbcSubmission[], week: string) => handlers.filter(handler => {
  const submission = submissions.find(s => s.projectId === activities[0]?.projectId && s.weekStart === week && s.handler === handler)
  return submission?.status === 'confirmed' && submissionStatus(submission, week, activities) !== 'Needs review'
}).length

/** Shared read-only validation; only supported weight arithmetic is evaluated. */
export function readNbcWorkbook(template: Uint8Array, activities: NbcActivity[]) {
  if (!activities.length) throw new Error('There are no BOQ activities to export.')
  if (template.byteLength > MAX_TEMPLATE_BYTES) throw new Error('Choose an XLSX template up to 10 MB.')
  let expanded = 0
  const files = unzipSync(template, { filter: file => {
    expanded += file.originalSize
    if (expanded > 50 * 1024 * 1024) throw new Error('The Excel template is too large to process safely.')
    return true
  } })
  const book = xml(files['xl/workbook.xml']), rels = xml(files['xl/_rels/workbook.xml.rels'])
  const expected = ['Progress', ...handlers], sheets = elements(book, 'sheet').slice(0, expected.length)
  // Extra reference sheets after the handler tabs (Notes, Weights, Schedule Import in BP02) are left untouched.
  if (sheets.length !== expected.length || sheets.some((s, i) => s.getAttribute('name') !== expected[i])) throw new Error('Use the NBC workbook with Progress and all six handler sheets.')
  const strings = files['xl/sharedStrings.xml'] ? elements(xml(files['xl/sharedStrings.xml']), 'si').map(si => elements(si, 't').map(t => t.textContent ?? '').join('')) : []
  const paths = sheets.map(sheet => {
    const rel = [...rels.documentElement.children].find(r => r.getAttribute('Id') === sheet.getAttributeNS(REL, 'id'))
    const target = rel?.getAttribute('Target') ?? ''
    const path = target.startsWith('/xl/') ? target.slice(1) : `xl/${target}`
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path) || rel?.getAttribute('TargetMode') === 'External') throw new Error('The template contains an unsupported worksheet reference.')
    return path
  })
  const docs = paths.map(path => xml(files[path]))
  const read = (cell: Element | undefined) => {
    if (!cell) return ''
    if (cell.getAttribute('t') === 's') return strings[Number(elements(cell, 'v')[0]?.textContent)] ?? ''
    return elements(cell, cell.getAttribute('t') === 'inlineStr' ? 't' : 'v').map(v => v.textContent ?? '').join('')
  }
  const findCell = (row: Element, column: string) => [...row.children].find(c => c.getAttribute('r')?.replace(/\d+$/, '') === column)
  const rows = (doc: Document) => elements(doc, 'row')
  const wbsRows = (doc: Document) => {
    const entries = rows(doc).flatMap(row => { const key = read(findCell(row, 'A')); return /^1\.\d+(?:\.\d+)+$/.test(key) || key === 'GR&P' ? [[key, row] as const] : [] })
    const result = new Map(entries)
    if (result.size !== entries.length) throw new Error('The template contains duplicate WBS activities.')
    return result
  }
  const masterRows = wbsRows(docs[0]!), byWbs = new Map(activities.map(a => [a.wbs, a]))
  if (masterRows.size !== activities.length || byWbs.size !== activities.length || activities.some(a => !masterRows.has(a.wbs))) throw new Error('The template WBS activities do not match this project. Choose the matching NBC workbook.')
  const weight = weightValues(new Map(elements(docs[0]!, 'c').map(cell => [cell.getAttribute('r')!, cell])), read)
  for (const a of activities) {
    if (a.editable && a.wbs !== 'GR&P' && !handlers.some(h => h === a.handler)) throw new Error(`Assign WBS ${a.wbs} to one of the six handlers before exporting.`)
    const row = masterRows.get(a.wbs)!
    if (read(findCell(row, 'J')) !== a.name) throw new Error(`Template task name does not match WBS ${a.wbs}.`)
    for (const [column, value] of [['K', a.relativeWeight], ['S', a.globalWeight]] as const) {
      let actual: number
      try { actual = weight(`${column}${row.getAttribute('r')}`) } catch { throw new Error(`Template weighting cannot be read for WBS ${a.wbs}.`) }
      if (Math.abs(actual - value) > 1e-9) throw new Error(`Template weighting does not match WBS ${a.wbs}.`)
    }
  }
  return { files, book, rels, paths, docs, read, findCell, rows, wbsRows, masterRows, byWbs }
}

/** Patches a copy of the private template; unrelated workbook parts stay byte-identical. */
export function weeklyWorkbook(template: Uint8Array, activities: NbcActivity[], submissions: NbcSubmission[], week: string) {
  const { files, book, rels, paths, docs, read, findCell, rows, wbsRows, masterRows, byWbs } = readNbcWorkbook(template, activities)
  const { current, previous } = reportValues(activities, submissions, week)
  const set = (row: Element, column: string, value: number | string, formula?: string) => {
    const doc = row.ownerDocument
    let cell = findCell(row, column)
    if (!cell) {
      cell = doc.createElementNS(NS, 'c'); cell.setAttribute('r', `${column}${row.getAttribute('r')}`)
      const next = [...row.children].find(c => c.getAttribute('r')!.replace(/\d+$/, '').localeCompare(column, 'en', { numeric: false }) > 0)
      row.insertBefore(cell, next ?? null)
    }
    cell.replaceChildren(); cell.removeAttribute('t')
    if (typeof value === 'string') {
      cell.setAttribute('t', 'inlineStr')
      const inline = doc.createElementNS(NS, 'is'), text = doc.createElementNS(NS, 't')
      text.textContent = value; text.setAttribute('xml:space', 'preserve'); inline.append(text); cell.append(inline)
    } else {
      if (!Number.isFinite(value)) throw new Error('The report contains an invalid progress value.')
      if (formula) { const f = doc.createElementNS(NS, 'f'); f.textContent = formula; cell.append(f) }
      const v = doc.createElementNS(NS, 'v'); v.textContent = String(value); cell.append(v)
    }
  }
  const rowNumber = (a: NbcActivity) => masterRows.get(a.wbs)!.getAttribute('r')!
  const handlerRows = new Map<string, { handler: string; row: number }>()
  const ordered = [...activities].sort((a, b) => a.order - b.order || a.wbs.localeCompare(b.wbs))
  const templates = docs.slice(1).map(doc => {
    const levels = new Map<string, Element>()
    for (const [wbs, row] of wbsRows(doc)) {
      const a = byWbs.get(wbs)
      if (a) levels.set(`${wbs.split('.').length}:${a.editable}`, row)
    }
    return levels
  })
  const rootOf = (a: NbcActivity) => { let node = a; while (node.parentId && current.byId.get(node.parentId)) node = current.byId.get(node.parentId)!; return node }
  // BP02 handler tabs carry a floor code in column N; reuse the one the template already shows for each floor.
  const floorCodes = new Map<string, string>()
  for (const doc of docs.slice(1)) for (const [wbs, row] of wbsRows(doc)) {
    const code = read(findCell(row, 'N')), a = byWbs.get(wbs)
    if (code && a) floorCodes.set(rootOf(a).wbs, code)
  }
  // Rebuild handler rows from current assignments, keeping the template's row styles by level.
  for (const [i, handler] of handlers.entries()) {
    const doc = docs[i + 1]!, data = elements(doc, 'sheetData')[0]!
    const included = new Set<string>()
    for (const a of activities) if (a.editable && a.wbs !== 'GR&P' && a.handler === handler) {
      let node: NbcActivity | undefined = a
      while (node && !included.has(node.id)) { included.add(node.id); node = node.parentId ? current.byId.get(node.parentId) : undefined }
    }
    const body = ordered.filter(a => included.has(a.id))
    const existing = wbsRows(doc)
    if (existing.size === body.length && body.every(a => existing.has(a.wbs))) {
      for (const a of body.filter(a => a.editable)) {
        const row = existing.get(a.wbs)!, number = Number(row.getAttribute('r'))
        set(row, 'K', previous.progress.get(a.id)!); set(row, 'M', current.progress.get(a.id)!)
        set(row, 'L', Math.round((current.progress.get(a.id)! - previous.progress.get(a.id)!) * 1e6) / 1e6, `ROUND(M${number}-K${number},6)`)
        handlerRows.set(a.id, { handler, row: number })
      }
      continue
    }
    for (const row of rows(doc)) if (Number(row.getAttribute('r')) >= 5) row.remove()
    body.forEach((a, index) => {
      const depth = a.wbs.split('.').length
      const key = `${depth}:${a.editable}`
      const prototype = templates[i]!.get(key) ?? templates.map(levels => levels.get(key)).find(Boolean)
      if (!prototype) throw new Error(`The ${handler} sheet is missing a required row format.`)
      const row = doc.importNode(prototype, true), number = index + 5
      row.setAttribute('r', String(number))
      for (const cell of row.children) { cell.setAttribute('r', cell.getAttribute('r')!.replace(/\d+$/, String(number))); cell.replaceChildren(); cell.removeAttribute('t') }
      // The name goes in the hierarchy column the Progress sheet uses for this row (differs between projects).
      const master = masterRows.get(a.wbs)!, levelColumn = 'BCDEFGHI'.split('').find(column => read(findCell(master, column)) !== '')
      set(row, 'A', a.wbs); set(row, levelColumn ?? String.fromCharCode(65 + Math.min(depth, 8)), a.name); set(row, 'J', a.name)
      const floor = floorCodes.get(rootOf(a).wbs)
      if (floor) set(row, 'N', floor)
      if (a.editable) {
        set(row, 'K', previous.progress.get(a.id)!); set(row, 'M', current.progress.get(a.id)!)
        set(row, 'L', Math.round((current.progress.get(a.id)! - previous.progress.get(a.id)!) * 1e6) / 1e6, `ROUND(M${number}-K${number},6)`)
        handlerRows.set(a.id, { handler, row: number })
      }
      data.append(row)
    })
    const dimension = elements(doc, 'dimension')[0], lastColumn = /:([A-Z]+)\d+$/.exec(dimension?.getAttribute('ref') ?? '')?.[1] ?? 'M'
    dimension?.setAttribute('ref', `A1:${lastColumn.length > 1 || lastColumn > 'M' ? lastColumn : 'M'}${Math.max(4, body.length + 4)}`)
  }
  for (const a of activities) {
    const row = masterRows.get(a.wbs)!, r = rowNumber(a), children = current.children.get(a.id) ?? [], assigned = handlerRows.get(a.id)
    const sum = (column: string) => children.map(c => `K${rowNumber(c)}*${column}${rowNumber(c)}`).join('+')
    const before = previous.progress.get(a.id)!, after = current.progress.get(a.id)!
    set(row, 'L', before, children.length ? sum('L') : assigned ? `'${assigned.handler}'!K${assigned.row}` : undefined)
    set(row, 'N', after, children.length ? sum('N') : assigned ? `'${assigned.handler}'!M${assigned.row}` : undefined)
    set(row, 'M', Math.round((after - before) * 1e6) / 1e6, `ROUND(N${r}-L${r},6)`)
    set(row, 'O', a.relativeWeight * after, `K${r}*N${r}`)
    set(row, 'P', a.globalWeight * after, `S${r}*N${r}`)
  }
  const total = rows(docs[0]!).find(row => row.getAttribute('r') === '5')
  if (!total || read(findCell(total, 'J')) !== 'TOTAL') throw new Error('The template is missing its progress total row.')
  const roots = current.children.get(null) ?? [], weight = roots.reduce((sum, a) => sum + a.relativeWeight, 0)
  const weighted = (column: string) => roots.map(a => `K${rowNumber(a)}*${column}${rowNumber(a)}`).join('+')
  set(total, 'L', weight ? previous.overall / weight : 0, `IFERROR((${weighted('L')})/K5,0)`)
  set(total, 'N', weight ? current.overall / weight : 0, `IFERROR((${weighted('N')})/K5,0)`)
  set(total, 'M', weight ? Math.round((current.overall - previous.overall) / weight * 1e6) / 1e6 : 0, 'ROUND(N5-L5,6)')
  set(total, 'P', current.overall, `SUM(${roots.map(a => `P${rowNumber(a)}`).join(',')})`)
  const confirmed = confirmedCount(activities, submissions, week)
  for (const [i, doc] of docs.entries()) {
    let period = rows(doc).find(row => row.getAttribute('r') === '3')
    if (!period) { period = doc.createElementNS(NS, 'row'); period.setAttribute('r', '3'); const data = elements(doc, 'sheetData')[0]!; data.insertBefore(period, rows(doc).find(row => Number(row.getAttribute('r')) > 3) ?? null) }
    set(period, 'A', `Reporting week: ${reportingBlock(week)} ${week.slice(0, 4)}. ${confirmed}/6 handlers confirmed.`)
    files[paths[i]!] = bytes(doc)
  }
  let calc = elements(book, 'calcPr')[0]
  if (!calc) { calc = book.createElementNS(NS, 'calcPr'); book.documentElement.append(calc) }
  calc.setAttribute('calcMode', 'auto'); calc.setAttribute('fullCalcOnLoad', '1'); calc.setAttribute('forceFullCalc', '1')
  files['xl/workbook.xml'] = bytes(book)
  const types = xml(files['[Content_Types].xml'])
  Array.from(rels.documentElement.children).filter(rel => rel.getAttribute('Type')?.endsWith('/calcChain')).forEach(rel => rel.remove())
  Array.from(types.documentElement.children).filter(type => type.getAttribute('PartName') === '/xl/calcChain.xml').forEach(type => type.remove())
  delete files['xl/calcChain.xml']; files['xl/_rels/workbook.xml.rels'] = bytes(rels); files['[Content_Types].xml'] = bytes(types)
  return { bytes: zipSync(files, { level: 6 }), confirmed }
}
