import { GlassSelect } from '@/components/glass/GlassSelect'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '@/data'
import type { PaletteColor, ProjectSummary } from '@/data'
import { projectIcons, Tile, tint } from './WorkspaceUI'

export function ProjectEditor({ project, onClose }: { project: ProjectSummary; onClose: () => void }) {
  const [draft, setDraft] = useState(project)
  const [error, setError] = useState('')
  const update = (patch: Partial<ProjectSummary>) => setDraft({ ...draft, ...patch })
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="event-editor project-editor glass" data-material="thick">
          <div className="row-between">
            <div className="inline"><Tile name={draft.icon || draft.id} color={draft.color} /><Dialog.Title className="t-h3">Edit project</Dialog.Title></div>
            <Dialog.Close className="ibtn" aria-label="Close project editor"><X size={18} /></Dialog.Close>
          </div>
          <Dialog.Description className="small muted">A few details to give your project a clear direction.</Dialog.Description>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (!draft.name.trim()) { setError('Enter a project name.'); return }
            if (draft.startDate && draft.target && draft.target < draft.startDate) { setError('Target date must be on or after the start date.'); return }
            useWorkspace.getState().updateProject(project.id, { workspace: draft.workspace ?? 'personal', name: draft.name.trim(), description: draft.description, icon: draft.icon, color: draft.color, status: draft.status, startDate: draft.startDate, target: draft.target })
            onClose()
          }}>
            <label>Project name<input autoFocus required maxLength={200} value={draft.name} onChange={(e) => update({ name: e.target.value })} /></label>
            <label htmlFor="project-workspace">Workspace<GlassSelect id="project-workspace" value={draft.workspace ?? 'personal'} onChange={(e) => update({ workspace: e.target.value as 'team' | 'personal' })}><option value="team">Team Workspace</option><option value="personal">Personal Workspace</option></GlassSelect></label>
            <label>Description<textarea rows={3} maxLength={2000} placeholder="What are you working toward?" value={draft.description} onChange={(e) => update({ description: e.target.value })} /></label>
            <div className="form-columns">
              <label>Status<GlassSelect value={draft.status || 'Active'} onChange={(e) => update({ status: e.target.value as ProjectSummary['status'] })}>{['Planned', 'Active', 'On hold', 'Completed', 'Archived'].map((s) => <option key={s}>{s}</option>)}</GlassSelect></label>
              <label>Icon<input maxLength={12} placeholder="Project icon" value={draft.icon || ''} onChange={(e) => update({ icon: e.target.value })} /></label>
            </div>
            <fieldset className="project-colors"><legend>Project icon</legend><div className="project-icon-choices">{Object.keys(projectIcons).map((icon) => <button type="button" key={icon} className="ibtn" aria-label={`Use ${icon.replaceAll('-', ' ')} icon`} title={icon.replaceAll('-', ' ')} aria-pressed={(draft.icon || draft.id) === icon} onClick={() => update({ icon })}><Tile name={icon} color={draft.color} /></button>)}</div></fieldset>
            <div className="form-columns">
              <label>Start date<input type="date" value={draft.startDate || ''} onChange={(e) => update({ startDate: e.target.value })} /></label>
              <label>Target date<input type="date" min={draft.startDate || undefined} value={draft.target || ''} onChange={(e) => update({ target: e.target.value })} /></label>
            </div>
            <fieldset className="project-colors"><legend>Project color</legend><div className="inline">{(['blue', 'purple', 'green', 'orange', 'red', 'pink', 'gray'] as PaletteColor[]).map((color) => <button type="button" key={color} style={tint(color)} className="color-choice" aria-label={color} aria-pressed={draft.color === color} onClick={() => update({ color })}>{draft.color === color && <Check size={16} />}</button>)}</div></fieldset>
            {error && <p className="form-error small" role="alert">{error}</p>}
            <footer><Dialog.Close className="btn-secondary" type="button">Cancel</Dialog.Close><button className="btn-accent" type="submit">Save changes</button></footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
