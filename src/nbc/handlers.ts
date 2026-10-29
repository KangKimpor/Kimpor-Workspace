import type { NbcActivity } from './types'

export function activityHandlers(activity: NbcActivity, activities: NbcActivity[]) {
  if (activity.editable) return activity.handler || (activity.wbs === 'GR&P' ? 'Shared' : 'Unassigned')
  return [...new Set(activities.filter((a) => a.editable && a.wbs.startsWith(`${activity.wbs}.`)).map((a) => a.handler || 'Unassigned'))].join(', ') || 'Unassigned'
}
