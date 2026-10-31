import { calculate } from './progress'
import type { NbcActivity } from './types'

export interface WbsRow { activity: NbcActivity; depth: number; level: number; group: boolean; leafCount: number; progress: number }
export interface WbsOptions { leaf?: (a: NbcActivity) => boolean; collapsed?: ReadonlySet<string>; values?: ReadonlyMap<string, number> }

/** Level 1 is `1.6.1` for standard projects; for BP02, level 1 is `1.8.1.3` (4-segment codes). Shared GR&P sits at level 1. */
export const wbsLevel = (wbs: string, projectId?: string) => {
  if (wbs === 'GR&P') return 1
  const isBp02 = projectId === 'nbc-bp02' || (!projectId && wbs.startsWith('1.8.'))
  const offset = isBp02 ? 3 : 2
  return Math.max(1, wbs.split('.').length - offset)
}

export function buildWbsRows(activities: NbcActivity[], options: WbsOptions = {}): WbsRow[] {
  const { leaf = () => true, collapsed, values } = options
  const { byId, children, progress } = calculate(activities, values && new Map(values))
  const included = new Set<string>(), leaves = new Map<string, number>()
  for (const a of activities) if (a.editable && leaf(a)) {
    let node: NbcActivity | undefined = a
    while (node) {
      included.add(node.id)
      leaves.set(node.id, (leaves.get(node.id) ?? 0) + 1)
      node = node.parentId ? byId.get(node.parentId) : undefined
    }
  }
  const rows: WbsRow[] = []
  const rank = (a: NbcActivity) => a.wbs === 'GR&P' ? 1 : 0
  function walk(parent: string | null) {
    const siblings = [...(children.get(parent) ?? [])].sort((a, b) => rank(a) - rank(b) || a.order - b.order)
    for (const a of siblings) if (included.has(a.id)) {
      const level = wbsLevel(a.wbs, a.projectId)
      rows.push({ activity: a, depth: level - 1, level, group: !a.editable, leafCount: leaves.get(a.id) ?? 0, progress: progress.get(a.id)! })
      if (!collapsed?.has(a.id)) walk(a.id)
    }
  }
  walk(null)
  return rows
}
