import { readNbcWorkbook } from '../export/workbook'
import { calculate, percentage } from '../progress'
import { handlers } from '../types'
import type { NbcActivity } from '../types'

/** Handler accumulation inputs are authoritative; cached master formulas may be stale. */
export function importPercentages(bytes: Uint8Array, activities: NbcActivity[]) {
  const { docs, read, findCell, wbsRows, masterRows, byWbs } = readNbcWorkbook(bytes, activities)
  const values = new Map<string, number>(), leaves = new Map(activities.filter(a => a.editable).map(a => [a.wbs, a]))
  function numeric(row: Element, column: string, wbs: string) {
    const cell = findCell(row, column), raw = read(cell)
    if (!cell || !raw.trim() || ![null, 'n'].includes(cell.getAttribute('t')) || cell.getElementsByTagName('f').length) throw new Error(`Enter a numeric accumulation percentage for WBS ${wbs}; formulas and blank inputs cannot be imported.`)
    try { return percentage(Number(raw)) } catch { throw new Error(`WBS ${wbs}: accumulation must be between 0% and 100%.`) }
  }
  for (const [i] of handlers.entries()) for (const [wbs, row] of wbsRows(docs[i + 1]!)) {
    if (!byWbs.has(wbs)) throw new Error(`Unknown WBS ${wbs} in a handler sheet.`)
    const a = leaves.get(wbs)
    if (!a || a.wbs === 'GR&P') continue
    // Group rows have no accumulation input; a leaf must occur on exactly one handler sheet.
    if (values.has(a.id)) throw new Error(`Duplicate handler input for WBS ${wbs}.`)
    if (read(findCell(row, 'J')) !== a.name) throw new Error(`Task name does not match WBS ${wbs}.`)
    values.set(a.id, numeric(row, 'M', wbs))
  }
  for (const a of leaves.values()) {
    if (a.wbs === 'GR&P') values.set(a.id, numeric(masterRows.get(a.wbs)!, 'N', a.wbs))
    if (!values.has(a.id)) throw new Error(`Missing handler accumulation input for WBS ${a.wbs}.`)
  }
  return { values, overall: calculate(activities, values).overall }
}
