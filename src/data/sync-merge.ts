type RecordData = Record<string, unknown>
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export function changedFields(before: RecordData, after: RecordData): RecordData {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => !equal(before[key], value)))
}
/** Merge independent fields; keep overlapping drafts for explicit recovery. */
export function rebaseWrite(original: RecordData, local: RecordData, remote: RecordData | null) {
  const patch = changedFields(original, local)
  const conflicts = !remote || (remote.deletedAt && !local.deletedAt) || Object.keys(patch).some((key) =>
    !['updatedAt', 'activity', 'completedAt'].includes(key) && !equal(remote[key], original[key]) && !equal(remote[key], local[key]),
  )
  return { conflicts: !!conflicts, data: { ...remote, ...patch } }
}
