import type { Task } from './types'

export function canParentTask(
  tasks: Task[],
  id: string,
  parentId: string | null,
): boolean {
  const task = tasks.find((t) => t.id === id)
  let ancestor = parentId,
    depth = 0
  const seen = new Set([id])
  while (ancestor) {
    if (seen.has(ancestor)) return false
    seen.add(ancestor)
    const parent = tasks.find((t) => t.id === ancestor && !t.deletedAt)
    if (!parent || parent.projectId !== task?.projectId || ++depth > 2)
      return false
    ancestor = parent.parentId ?? null
  }
  const height = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 3
    const next = new Set(visited).add(nodeId)
    return Math.max(
      0,
      ...tasks
        .filter((t) => t.parentId === nodeId && !t.deletedAt)
        .map((t) => 1 + height(t.id, next)),
    )
  }
  return depth + height(id) <= 2
}
