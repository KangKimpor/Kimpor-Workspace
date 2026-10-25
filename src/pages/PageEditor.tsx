import { GlassSelect } from '@/components/glass/GlassSelect'
import { Download, Plus, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Tile } from '@/components/WorkspaceUI'
import { RichEditor } from '@/components/RichEditor'
import { dateKey, useWorkspace } from '@/data'
import type { WorkspacePage } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { resolveFile, uploadWorkspaceFile } from '@/data/files'

function PageCover({ cover }: { cover: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    setUrl('')
    if (!cover.startsWith('linear-gradient'))
      void resolveFile(cover)
        .then((value) => {
          if (active) setUrl(value)
        })
        .catch(() => undefined)
    return () => {
      active = false
    }
  }, [cover])
  return cover.startsWith('linear-gradient') ? (
    <div className="page-cover" style={{ background: cover }} />
  ) : url ? (
    <img className="page-cover" alt="Page cover" src={url} />
  ) : null
}

function downloadMarkdown(page: WorkspacePage, body: string) {
  const url = URL.createObjectURL(
    new Blob([`# ${page.title}\n\n${body}`], { type: 'text/markdown' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${page.title.replace(/[<>:"/\\|?*]/g, '-') || 'Untitled'}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function PageEditor() {
  const { id } = useParams(),
    [params] = useSearchParams()
  const { pages, updatePage, addPage, reorderPage } = useWorkspace()
  const navigate = useNavigate(),
    notify = useWorkspaceUI((s) => s.notify)
  const opened = useRef<string | null>(null),
    exporter = useRef<(() => Promise<string>) | null>(null)
  const ready = useCallback((fn: () => Promise<string>) => {
    exporter.current = fn
  }, [])
  const [cover, setCover] = useState(false)
  const requestedDate = params.get('date') || dateKey()
  const page = pages.find((p) => p.id === id && !p.deletedAt)
  useEffect(() => {
    if (opened.current === id) return
    opened.current = id ?? null
    if (id === 'new') navigate(`/p/${addPage()}`, { replace: true })
    if (id === 'daily') {
      const title = `Daily note · ${/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dateKey()}`
      const existing = useWorkspace
        .getState()
        .pages.find((p) => p.title === title && !p.deletedAt)
      const target=existing?.id ?? addPage(title)
      if(!existing)updatePage(target,{blocks:[{id:crypto.randomUUID(),kind:'heading',text:'Focus for today'},{id:crypto.randomUUID(),kind:'todo',text:'One thing that matters',checked:false},{id:crypto.randomUUID(),kind:'heading',text:'Notes'},{id:crypto.randomUUID(),kind:'paragraph',text:''}]})
      navigate(`/p/${target}`, { replace: true })
    }
  }, [id, requestedDate, navigate, addPage,updatePage])
  if (id === 'new' || id === 'daily')
    return (
      <div className="page" role="status">
        Opening your page…
      </div>
    )
  if (!page)
    return (
      <div className="page">
        <h1 className="t-h1">Page not found</h1>
        <Link to="/trash">Check Trash</Link>
      </div>
    )
  const update = (patch: Partial<WorkspacePage>) => updatePage(page.id, patch)
  const backlinks = pages.filter(
    (p) =>
      p.id !== page.id &&
      !p.deletedAt &&
      JSON.stringify(p.content ?? []).includes(`"id":"${page.id}"`),
  )
  return (
    <article className="workspace-surface document-surface">
      <div className="document-actions">
        <span className="small muted">Pages / {page.title || 'Untitled'}</span>
        <div className="inline">
          <button
            className="ibtn"
            aria-label={
              page.isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={page.isFavorite}
            onClick={() => update({ isFavorite: !page.isFavorite })}
          >
            <Star size={17} fill={page.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            className="ibtn"
            aria-label="Export Markdown"
            onClick={() =>
              void exporter
                .current?.()
                .then((body) => downloadMarkdown(page, body))
            }
          >
            <Download size={17} />
          </button>
          <button
            className="ibtn"
            aria-label="Move page to Trash"
            onClick={() => {
              update({ deletedAt: new Date().toISOString() })
              navigate('/')
              notify('Page moved to Trash', () =>
                updatePage(page.id, { deletedAt: null }),
              )
            }}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <div
        className="document-body"
        data-font={page.font ?? 'default'}
        data-small={page.smallText}
        data-wide={page.fullWidth}
      >
        {page.cover && <PageCover cover={page.cover} />}
        <div className="page-options">
          <GlassSelect
            aria-label="Page icon"
            value={page.icon}
            onChange={(e) => update({ icon: e.target.value })}
          >
            {['note', 'book', 'star', 'bulb', 'flag', 'layout'].map((icon) => (
              <option key={icon}>{icon}</option>
            ))}
            {!['note','book','star','bulb','flag','layout'].includes(page.icon)&&<option value={page.icon}>Custom icon</option>}
          </GlassSelect>
          <label>Emoji<input className="emoji-input" aria-label="Page emoji" placeholder="🙂" maxLength={12} value={/\p{Extended_Pictographic}/u.test(page.icon)?page.icon:''} onChange={e=>update({icon:e.target.value || 'note'})}/></label>
          <label className="btn-text">Upload icon<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload page icon" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadWorkspaceFile(file).then(icon=>update({icon})).catch(error=>notify(error.message))}}/></label>
          <button className="btn-text" onClick={() => setCover(!cover)}>
            Cover
          </button>
          <label>
            Font
            <GlassSelect
              value={page.font ?? 'default'}
              onChange={(e) =>
                update({ font: e.target.value as WorkspacePage['font'] })
              }
            >
              {['default', 'serif', 'mono'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </GlassSelect>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!page.fullWidth}
              onChange={(e) => update({ fullWidth: e.target.checked })}
            />
            Full width
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!page.smallText}
              onChange={(e) => update({ smallText: e.target.checked })}
            />
            Small text
          </label>
        </div>
        {cover && (
          <div className="filter-controls">
            <label className="btn-secondary">
              Upload cover
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Upload page cover"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file)
                    void uploadWorkspaceFile(file)
                      .then((cover) => update({ cover }))
                      .catch((error) => notify(error.message))
                }}
              />
            </label>
            {['blue', 'purple', 'green', 'orange'].map((c) => (
              <button
                className="btn-secondary"
                key={c}
                onClick={() =>
                  update({
                    cover: `linear-gradient(120deg,var(--chip-${c}),var(--bg-canvas))`,
                  })
                }
              >
                {c}
              </button>
            ))}
            <button className="btn-text" onClick={() => update({ cover: '' })}>
              Remove cover
            </button>
          </div>
        )}
        <div className="document-icon">
          <Tile name={page.icon} />
        </div>
        <input
          aria-label="Page title"
          className="page-title-input"
          placeholder="Untitled"
          value={page.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <div className="document-meta">
          <label className="inline small muted">
            Inside
            <GlassSelect
              aria-label="Parent page"
              value={page.parentId ?? ''}
              onChange={(e) => {
                if (!reorderPage(page.id, e.target.value || null))
                  notify('A page cannot be nested inside itself.')
              }}
            >
              <option value="">Workspace</option>
              {pages
                .filter((p) => p.id !== page.id && !p.deletedAt)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || 'Untitled'}
                  </option>
                ))}
            </GlassSelect>
          </label>
          <button
            className="btn-text"
            onClick={() => navigate(`/p/${addPage('Untitled', page.id)}`)}
          >
            <Plus size={13} />
            Subpage
          </button>
          <span className="small muted">
            Edited {new Date(page.updatedAt).toLocaleString()}
          </span>
        </div>
        <RichEditor key={page.id} page={page} onExportReady={ready} />
        <div className="document-children">
          {pages
            .filter((p) => p.parentId === page.id && !p.deletedAt)
            .map((p) => (
              <Link
                className="flat-card document-child"
                to={`/p/${p.id}`}
                key={p.id}
              >
                <Tile name={p.icon} />
                {p.title || 'Untitled'}
              </Link>
            ))}
        </div>
        {!!backlinks.length && (
          <section className="settings-section">
            <h2 className="t-h3">Linked from</h2>
            {backlinks.map((p) => (
              <Link key={p.id} className="document-child" to={`/p/${p.id}`}>
                {p.title}
              </Link>
            ))}
          </section>
        )}
      </div>
    </article>
  )
}
export function Trash() {
  const { pages, updatePage } = useWorkspace()
  const deleted = pages.filter(
    (p) =>
      p.deletedAt &&
      Date.now() - new Date(p.deletedAt).getTime() < 30 * 86400000,
  )
  return (
    <div className="page" data-wide="true">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Trash</h1>
          <p className="muted">
            Restore pages deleted within the last 30 days.
          </p>
        </div>
      </header>
      {deleted.map((p) => (
        <div className="trash-row flat-card" key={p.id}>
          <Tile name={p.icon} />
          <strong>{p.title || 'Untitled'}</strong>
          <button
            className="btn-secondary"
            onClick={() =>
              updatePage(p.id, { deletedAt: null, parentId: null })
            }
          >
            Restore page
          </button>
        </div>
      ))}
      {!deleted.length && (
        <div className="quiet-empty flat-card">Your trash is empty.</div>
      )}
    </div>
  )
}
