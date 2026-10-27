import type { NbcActivity } from './types'

export function parseProgress(text: string) {
  const clean = text.trim().replace(/%$/, '').trim()
  if (!/^(?:\d+(?:\.\d*)?|\.\d+|[-+]\d+(?:\.\d*)?)$/.test(clean) || !Number.isFinite(Number(clean))) throw new Error('Enter a numeric percentage.')
  const value = Number(clean), clamped = Math.max(0, Math.min(100, value))
  return { progress: clamped / 100, message: value !== clamped ? 'Progress must be between 0% and 100%.' : '' }
}

export function percentage(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Progress must be between 0% and 100%.')
  return value
}
export function calculate(activities: NbcActivity[], values?: Map<string, number>) {
  const byId = new Map(activities.map((a) => [a.id, a]))
  if (byId.size !== activities.length) throw new Error('Duplicate WBS identifier.')
  const children = new Map<string | null, NbcActivity[]>()
  for (const a of activities) {
    if (!Number.isFinite(a.relativeWeight) || a.relativeWeight < 0 || !Number.isFinite(a.globalWeight) || a.globalWeight < 0) throw new Error(`Invalid weight: ${a.wbs}`)
    if (a.parentId && !byId.has(a.parentId)) throw new Error(`Missing parent: ${a.wbs}`)
    const siblings = children.get(a.parentId) ?? []
    siblings.push(a)
    children.set(a.parentId, siblings)
  }
  const progress = new Map<string, number>(), visiting = new Set<string>()
  function visit(a: NbcActivity): number {
    if (progress.has(a.id)) return progress.get(a.id)!
    if (visiting.has(a.id)) throw new Error('Cyclic WBS hierarchy.')
    visiting.add(a.id)
    const cs = children.get(a.id) ?? []
    if (a.editable === !!cs.length) throw new Error(`Invalid editable rule: ${a.wbs}`)
    const weight = cs.reduce((sum, c) => sum + c.relativeWeight, 0)
    const value = cs.length ? (weight ? cs.reduce((sum, c) => sum + c.relativeWeight * visit(c), 0) / weight : 0) : percentage(values?.get(a.id) ?? a.progress)
    progress.set(a.id, value)
    visiting.delete(a.id)
    return value
  }
  for (const a of activities) visit(a)
  const leaves = activities.filter((a) => a.editable)
  const overall = leaves.reduce((sum, a) => sum + a.globalWeight * progress.get(a.id)!, 0)
  return { byId, children, progress, leaves, overall }
}
export function summarize(activities: NbcActivity[], previous?: Map<string, number>, since?: string) {
  const leaves = activities.filter((a) => a.editable)
  const weight = leaves.reduce((s, a) => s + a.globalWeight, 0)
  const contribution = leaves.reduce((s, a) => s + a.globalWeight * a.progress, 0)
  return { count: leaves.length, completed: leaves.filter((a) => a.progress === 1).length,
    inProgress: leaves.filter((a) => a.progress > 0 && a.progress < 1).length,
    notStarted: leaves.filter((a) => a.progress === 0).length, weight, contribution,
    progress: weight ? contribution / weight : 0,
    changed: leaves.filter((a) => a.progress !== (previous?.get(a.id) ?? a.baseline)).length,
    updated: leaves.filter((a) => a.history.some((h) => !since || h.at >= since)).length }
}
export function visibleHierarchy(activities: NbcActivity[], match: (a: NbcActivity) => boolean, collapsed: Set<string>, sort: 'wbs' | 'name' | 'progress', progress: Map<string, number>) {
  const { byId, children } = calculate(activities)
  const included = new Set<string>()
  for (const a of activities) if (match(a)) {
    let node: NbcActivity | undefined = a
    while (node && !included.has(node.id)) { included.add(node.id); node = node.parentId ? byId.get(node.parentId) : undefined }
  }
  const rows: { activity: NbcActivity; depth: number }[] = []
  function walk(parent: string | null, depth: number) {
    const siblings = [...(children.get(parent) ?? [])].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'progress' ? progress.get(b.id)! - progress.get(a.id)! || a.order - b.order : a.order - b.order)
    for (const a of siblings) if (included.has(a.id)) {
      rows.push({ activity: a, depth })
      if (!collapsed.has(a.id)) walk(a.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}
