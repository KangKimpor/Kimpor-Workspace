import type { ProjectSummary } from '@/data'
type Selection = { workspace: 'team' | 'personal'; projectId?: string }
export function rememberWorkspace(scope: string, selection: Selection) {
  try { localStorage.setItem(`kw-start:${scope}`, JSON.stringify(selection)) } catch { /* Device preference is optional. */ }
}
export function workspaceStart(scope: string, projects: ProjectSummary[]) {
  let selected: Selection | undefined
  try { selected = JSON.parse(localStorage.getItem(`kw-start:${scope}`) || 'null') } catch { /* Default to Personal. */ }
  const workspace = selected?.workspace === 'team' ? 'team' : 'personal'
  const available = projects.filter((p) => p.status !== 'Archived')
  const project = selected?.projectId ? available.find((p) => p.id === selected.projectId) : selected ? undefined : available.find((p) => (p.workspace ?? 'personal') === workspace)
  return project ? project.nbcBp03 ? `/projects-progress/${encodeURIComponent(project.id)}/progress` : `/projects/${encodeURIComponent(project.id)}/table` : `/projects?workspace=${workspace}`
}
