import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

export interface IssueSource { title: string; projectId: string; nbcActivityId?: string | null }

export default function ReportIssue({ source, onClose }: { source: IssueSource; onClose: () => void }) {
  const [title, setTitle] = useState(`Issue: ${source.title}`.slice(0, 200)), [details, setDetails] = useState(''), [error, setError] = useState('')
  return <Dialog.Root open onOpenChange={open => !open && onClose()}><Dialog.Portal>
    <Dialog.Overlay className="scrim"/>
    <Dialog.Content className="event-editor project-editor glass" data-material="thick">
      <div className="row-between"><Dialog.Title className="t-h3">Report issue</Dialog.Title><Dialog.Close className="ibtn" aria-label="Close report issue"><X size={18}/></Dialog.Close></div>
      <Dialog.Description className="small muted">Related task: {source.title}</Dialog.Description>
      <form onSubmit={event => {
        event.preventDefault()
        if (!title.trim()) { setError('Enter an issue title.'); return }
        try {
          const state = useWorkspace.getState()
          const id = state.addTask({ title: title.trim(), projectId: source.projectId, nbcActivityId: source.nbcActivityId, notes: `Related task: ${source.title}\n\n${details.trim()}`, labels: ['Issue'] })
          useWorkspaceUI.getState().notify('Issue reported', () => useWorkspace.getState().trashTask(id))
          onClose()
        } catch (error) { setError((error as Error).message) }
      }}>
        <label>Issue title<input autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Details<textarea rows={4} maxLength={3500} placeholder="Describe what needs attention…" value={details} onChange={event => setDetails(event.target.value)}/></label>
        <p className="small muted">Saved as a private coordination task in this project.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><Dialog.Close type="button" className="btn-secondary">Cancel</Dialog.Close><button type="submit" className="btn-accent">Report issue</button></footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
