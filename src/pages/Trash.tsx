import * as Dialog from '@radix-ui/react-dialog'
import { FileText, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '@/data'
import { Tile } from '@/components/WorkspaceUI'
import './trash.css'

export default function Trash() {
  const pages = useWorkspace((s) => s.pages)
  const tasks = useWorkspace((s) => s.tasks)
  const [confirm, setConfirm] = useState(false)
  const deletedTasks = tasks.filter((task) => task.deletedAt)
  const taskPageIds = new Set(deletedTasks.map((task) => task.pageId))
  const deletedPages = pages.filter((page) => page.deletedAt && !taskPageIds.has(page.id))
  const activeTasks = new Set(tasks.filter((task) => !task.deletedAt).map((task) => task.id))
  const activePages = new Set(pages.filter((page) => !page.deletedAt).map((page) => page.id))
  const total = deletedPages.length + deletedTasks.length

  return <div className="page trash-page" data-wide="true">
    <header className="trash-heading">
      <div className="trash-emblem"><Trash2 size={28} strokeWidth={1.5} aria-hidden="true" /></div>
      <div><h1>Trash</h1><p>Restore what you need. Let go of the rest.</p></div>
      <button className="btn-secondary danger-text" disabled={!total} onClick={() => setConfirm(true)}>Empty Trash</button>
    </header>
    <section className="trash-panel" aria-label="Deleted items">
      <div className="trash-summary"><span>Deleted items</span><span role="status">{total} {total === 1 ? 'item' : 'items'}</span></div>
      {total ? <ul className="trash-list">
        {deletedTasks.map((task) => <li className="trash-row" key={task.id}>
          <span className="trash-item-icon"><FileText size={20} strokeWidth={1.5} aria-hidden="true" /></span>
          <div className="trash-item-title"><strong>{task.title || 'Untitled task'}</strong><span>Task</span></div>
          <button className="btn-secondary trash-restore" aria-label={`Restore task: ${task.title || 'Untitled task'}`} onClick={() => useWorkspace.getState().updateTask(task.id, { deletedAt: null, ...(task.parentId && !activeTasks.has(task.parentId) ? { parentId: null } : {}) })}><RotateCcw size={14} aria-hidden="true" />Restore</button>
        </li>)}
        {deletedPages.map((page) => <li className="trash-row" key={page.id}>
          <Tile name={page.icon} />
          <div className="trash-item-title"><strong>{page.title || 'Untitled'}</strong><span>Page</span></div>
          <button className="btn-secondary trash-restore" aria-label={`Restore page: ${page.title || 'Untitled'}`} onClick={() => useWorkspace.getState().updatePage(page.id, { deletedAt: null, parentId: page.parentId && activePages.has(page.parentId) ? page.parentId : null })}><RotateCcw size={14} aria-hidden="true" />Restore</button>
        </li>)}
      </ul> : <div className="trash-empty"><Trash2 size={40} strokeWidth={1.25} aria-hidden="true" /><h2>All clear.</h2><p>Your trash is empty.</p><p>Deleted pages and tasks will appear here.</p></div>}
    </section>
    <p className="trash-footnote">Items stay here until you empty Trash. Permanently deleted items can’t be recovered.</p>
    <Dialog.Root open={confirm} onOpenChange={setConfirm}><Dialog.Portal>
      <Dialog.Overlay className="scrim" />
      <Dialog.Content className="glass event-editor trash-dialog" data-material="thick">
        <div className="trash-emblem"><Trash2 size={24} aria-hidden="true" /></div>
        <Dialog.Title className="t-h3">Empty Trash?</Dialog.Title>
        <Dialog.Description>Permanently delete all {total} trashed items and their task notes. This cannot be undone.</Dialog.Description>
        <div className="trash-dialog-actions"><Dialog.Close className="btn-secondary">Cancel</Dialog.Close><button className="btn-secondary danger-text" onClick={() => { useWorkspace.getState().emptyTrash(); setConfirm(false) }}>Delete everything</button></div>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </div>
}
