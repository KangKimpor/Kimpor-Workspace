import { create } from 'zustand'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { supabase, initializeSupabase, hasStoredSession } from '@/lib/supabase'
import { useWorkspaceUI } from '@/shell/workspace'
import { contentOf, emptyContent, useWorkspace } from './index'
import { collections, db, eventWriteReady, purgedRows } from './persistence'
import type { Collection, Content, Pending } from './persistence'
import type { CalendarEvent, Task, WorkspacePage } from './types'
import { syncWorkspaceFiles } from './files'
import { changedFields, rebaseWrite } from './sync-merge'

export const useAccount = create<{
  session: Session | null; ready: boolean; error: string; recovering: boolean
}>(() => ({ session: null, ready: false, error: '', recovering: false }))
type Data = Record<string, unknown>
type CloudCollection = Collection | 'profiles'
type Write = Pending & { original: Data }
type Row = { id: string; data: Data; updated_at: string }
const pending = new Map<string, Write>()
const versions = new Map<string, string>()
let applying = false, generation = 0, initialized = false, hydrated = false
let activeRun: Promise<void> | undefined
let realtime: RealtimeChannel | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let googleTimer: ReturnType<typeof setTimeout> | undefined
let retry = 0, refreshRequested = false, live = false
let cloudInitialization: Promise<void> | undefined
const tabId = (() => {
  if (typeof navigator !== 'undefined' && navigator.locks) return crypto.randomUUID()
  try {
    const id = sessionStorage.getItem('kw-sync-tab') || crypto.randomUUID()
    sessionStorage.setItem('kw-sync-tab', id)
    return id
  } catch { return crypto.randomUUID() }
})()
const keyFor = (scope: string, collection: CloudCollection, id: string) => `${scope}:${collection}:${id}`
const recoveryKey = (scope: string) => `kw-cloud-pending:${scope}:${tabId}`
// A native lock distinguishes an active tab's recovery journal from an abandoned one.
if (typeof navigator !== 'undefined' && navigator.locks) void navigator.locks.request(`kw-sync-tab:${tabId}`, () => new Promise<void>((release) => addEventListener('pagehide', () => release(), { once: true }))).catch(() => {})

function profile(content: Content): Data {
  return { scratchpad: content.scratchpad, taskViews: content.taskViews ?? [], calendarPreferences: content.calendarPreferences }
}
function normalize(content: Content): Content {
  return { ...content, taskViews: content.taskViews ?? [], projects: content.projects.map((p) => ({ ...p, workspace: p.workspace === 'team' ? 'team' : 'personal' })) }
}
function saveRecovery() {
  const scope = useWorkspace.getState().scope
  if (scope === 'guest') return
  try {
    localStorage.setItem(recoveryKey(scope), JSON.stringify([...pending.values()]))
    localStorage.setItem(`kw-cloud-cache:${scope}`, JSON.stringify(contentOf(useWorkspace.getState())))
    if (useWorkspace.getState().storageError) useWorkspace.setState({ storageError: false })
    return true
  } catch { useWorkspace.setState({ storageError: true }); return false }
}
function cacheSnapshot(scope: string) {
  if (scope !== useWorkspace.getState().scope) return
  saveRecovery()
  // Cache failure must never prevent a server write or its acknowledgement.
  void db.snapshots.put({ scope, content: structuredClone(contentOf(useWorkspace.getState())) }).catch(() => {})
}
function queueRow(scope: string, collection: CloudCollection, id: string, before: Data, after: Data) {
  const key = keyFor(scope, collection, id), previous = pending.get(key)
  pending.set(key, { key, scope, collection, id, data: after, original: previous?.original ?? before, base: previous ? previous.base : versions.get(key) ?? (typeof before.updatedAt === 'string' ? before.updatedAt : null), version: crypto.randomUUID() })
}
function queueChanges(next: Content, previous: Content) {
  const scope = useWorkspace.getState().scope
  for (const collection of collections) {
    if (next[collection] === previous[collection]) continue
    const old = new Map((previous[collection] ?? []).map((row) => [row.id, row]))
    for (const row of next[collection] ?? []) {
      const before = old.get(row.id)
      if (JSON.stringify(row) !== JSON.stringify(before)) queueRow(scope, collection, row.id, (before ?? {}) as unknown as Data, row as unknown as Data)
    }
    if (collection === 'pages' || collection === 'tasks') {
      for (const row of purgedRows(collection, previous, next)) {
        const key = keyFor(scope, collection, row.id), queued = pending.get(key)
        pending.set(key, { key, scope, collection, id: row.id, data: { id: row.id }, original: row as unknown as Data, version: crypto.randomUUID(), base: queued ? queued.base : versions.get(key) ?? null, remove: true })
      }
    }
  }

  if (JSON.stringify(profile(next)) !== JSON.stringify(profile(previous))) queueRow(scope, 'profiles', scope, profile(previous), { id: scope, ...profile(next) })
  saveRecovery()
  void syncWorkspace(false)
}
export function pendingCollectionIds(collection: Collection) {
  const scope = useWorkspace.getState().scope
  return new Set([...pending.values()].filter((p) => p.scope === scope && p.collection === collection).map((p) => p.id))
}
export function pendingEventIds(scope: string) {
  return new Set([...pending.values()].filter((p) => p.scope === scope && p.collection === 'events').map((p) => p.id))
}
export function discardCalendarWrites(scope: string, ids: Set<string>) {
  for (const [key, write] of pending) if (write.scope === scope && write.collection === 'events' && ids.has(String(write.data.calendarId))) pending.delete(key)
  saveRecovery()
}
export async function initializeData() {
  if (initialized) return
  initialized = true
  useWorkspace.subscribe((state, previous) => {
    if (!applying && state.scope !== 'guest' && state.scope === previous.scope && (
      collections.some((c) => state[c] !== previous[c]) || state.scratchpad !== previous.scratchpad || state.taskViews !== previous.taskViews || state.calendarPreferences !== previous.calendarPreferences
    )) queueChanges(contentOf(state), contentOf(previous))
  })
  addEventListener('online', () => { void syncWorkspace(); startGoogle(generation) })
  addEventListener('offline', () => { if (useWorkspace.getState().scope !== 'guest') useWorkspace.setState({ sync: { kind: 'offline', pending: pending.size } }) })
  if (hasStoredSession() || /^\/settings\/(account|accounts)/.test(location.pathname)) await initializeCloud()
  else {
    try {
      const guest = await db.snapshots.get('guest')
      if (guest && !localStorage.getItem('kw-workspace-v1')) applyRemotePatch(normalize(guest.content))
    } catch { /* The demo can work in memory when browser storage is unavailable. */ }
    useAccount.setState({ ready: true })
  }
}
export function initializeCloud() {
  if (cloudInitialization) return cloudInitialization
  useAccount.setState({ ready: false, error: '' })
  cloudInitialization = (async () => {
    const client = await initializeSupabase()
    if (!client) { useAccount.setState({ ready: true }); return }
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') useAccount.setState({ recovering: true })
      setTimeout(() => void switchAccount(session), 0)
    })
    const { data, error } = await client.auth.getSession()
    if (error) useAccount.setState({ error: error.message })
    await switchAccount(data.session)
    useAccount.setState({ ready: true })
  })().catch((error) => {
    cloudInitialization = undefined
    useAccount.setState({ ready: true, error: error instanceof Error ? error.message : 'Could not connect to your account.' })
  })
  return cloudInitialization
}
async function switchAccount(session: Session | null) {
  const scope = session?.user.id ?? 'guest'
  const previousScope = useWorkspace.getState().scope
  useAccount.setState({ session })
  if (scope === previousScope) {
    if (session) { await supabase?.realtime.setAuth(session.access_token); void syncWorkspace() }
    return
  }
  saveRecovery()
  const current = ++generation
  clearTimeout(retryTimer); clearTimeout(googleTimer)
  if (realtime) { void supabase?.removeChannel(realtime); realtime = undefined }
  pending.clear(); versions.clear(); hydrated = false; live = false; retry = 0
  activeRun = undefined; refreshRequested = false
  useWorkspaceUI.setState({ eventId: null, commandOpen: false, toast: null })
  // Clear the previous account synchronously, before any asynchronous initialization.
  applyRemotePatch({ ...structuredClone(emptyContent) })
  useWorkspace.setState({ scope, sync: scope === 'guest' ? { kind: 'saved' } : { kind: 'saving' }, storageError: false })
  try {
    const raw = localStorage.getItem(scope === 'guest' ? 'kw-workspace-v1' : `kw-cloud-cache:${scope}`)
    if (raw) applyRemotePatch(normalize(JSON.parse(raw)))
    if (scope !== 'guest') {
      const writes: Write[] = JSON.parse(localStorage.getItem(recoveryKey(scope)) || '[]')
      for (const write of writes) if (write.scope === scope) { pending.set(write.key, write); applyRow(write.collection, write.remove ? null : { id: write.id, data: write.data, updated_at: String(write.data.updatedAt || '') }, write.id) }
    }
  } catch { /* An invalid cache cannot replace cloud content. */ }
  const google = await import('@/calendar/google')
  if (current !== generation) return
  google.clearGoogleSession()
  if (!session || !supabase) return
  await supabase.realtime.setAuth(session.access_token)
  if (current !== generation) return
  realtime = supabase.channel(`kw-workspace:${scope}`, { config: { private: true } })
  for (const collection of [...collections.filter((c) => !c.startsWith('nbc_')), 'profiles']) for (const event of ['INSERT', 'UPDATE'] as const) realtime.on('postgres_changes', { event, schema: 'public', table: `kw_${collection}`, ...(collection === 'projects' ? {} : {filter: `user_id=eq.${scope}`}) }, () => {
    if (current === generation) void syncWorkspace()
  })
  realtime.on('broadcast', { event: 'DELETE' }, () => { if (current === generation) void syncWorkspace() })
  realtime.on('system', {}, (message) => {
    if (current === generation && message.extension === 'postgres_changes' && message.status === 'error') { live = false; useWorkspace.setState({ sync: { kind: 'error', reason: 'Live updates unavailable. Check the workspace Realtime publication and permissions.' } }) }
  })
  realtime.subscribe((status) => {
    if (current !== generation) return
    live = status === 'SUBSCRIBED'
    if (live) void syncWorkspace()
    else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) useWorkspace.setState({ sync: { kind: 'error', reason: 'Live updates disconnected. Reconnecting; pending changes are retained.' } })
  })
  // Recovery work does not gate online writes.
  void recoverAbandoned(scope, current)
  void recoverLegacy(scope, current)
  await syncWorkspace()
  startGoogle(current)
}
async function recoverAbandoned(scope: string, current: number) {
  if (!navigator.locks) return
  const prefix = `kw-cloud-pending:${scope}:`
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix) && key !== recoveryKey(scope))
    for (const key of keys) await navigator.locks.request(`kw-sync-tab:${key.slice(prefix.length)}`, { ifAvailable: true }, (lock) => {
      if (!lock || current !== generation) return
      const writes: Write[] = JSON.parse(localStorage.getItem(key) || '[]')
      for (const write of writes) {
        if (write.scope !== scope) continue
        const existing = pending.get(write.key)
        if (existing && JSON.stringify(existing.data) !== JSON.stringify(write.data)) recoverConflict(write)
        else {
          pending.set(write.key, write)
          applyRow(write.collection, write.remove ? null : { id: write.id, data: write.data, updated_at: String(write.data.updatedAt || '') }, write.id)
        }
      }
      if (saveRecovery()) localStorage.removeItem(key)
    })
    if (current === generation && pending.size) void syncWorkspace()
  } catch { /* Keep unreadable recovery journals for manual backup. */ }
}
async function recoverLegacy(scope: string, current: number) {
  try {
    const old = await db.outbox.where('scope').equals(scope).toArray().catch(() => [] as Pending[])
    const legacy = localStorage.getItem(`kw-recovery:${scope}`)
    const snapshot = legacy ? await db.snapshots.get(scope).catch(() => undefined) : null
    if (current !== generation) return
    for (const item of old) if (!pending.has(item.key)) pending.set(item.key, { ...item, original: {} })
    if (legacy) {
      const recovered = normalize(JSON.parse(legacy))
      queueChanges(recovered, snapshot?.content ?? emptyContent)
      if (saveRecovery()) localStorage.removeItem(`kw-recovery:${scope}`)
    }
    if (old.length) { saveRecovery(); void syncWorkspace() }
  } catch { /* IndexedDB is optional for the cloud path. */ }
}
function startGoogle(current: number) {
  clearTimeout(googleTimer)
  if (current !== generation || !useAccount.getState().session) return
  void import('@/calendar/google').then(async (google) => {
    if (current !== generation) return
    await google.syncGoogle()
    if (current === generation) googleTimer = setTimeout(() => startGoogle(current), 30000)
  }).catch(() => { if (current === generation) googleTimer = setTimeout(() => startGoogle(current), 60000) })
}
export async function importLocalWorkspace() {
  if (!useAccount.getState().session || !hydrated) throw new Error('Connect to your signed-in workspace first')
  let guest: Content | undefined
  try { const raw = localStorage.getItem('kw-workspace-v1'); if (raw) guest = JSON.parse(raw) } catch { /* Try the old snapshot. */ }
  guest ??= (await db.snapshots.get('guest'))?.content
  if (!guest) throw new Error('No local demo to import')
  const current = contentOf(useWorkspace.getState()), merged = { ...current }
  const demoNbc = new Set(guest.projects.filter((p)=>p.nbcBp03).map((p)=>p.id))
  for (const collection of collections) {
    // Company BOQ data is initialized once administratively, never imported from a browser demo.
    if (collection.startsWith('nbc_')) continue
    const ids = new Set((current[collection] ?? []).map((r) => r.id))
    ;(merged[collection] as { id: string }[]) = [...(current[collection] ?? []), ...(guest[collection] ?? []).filter((r) => !ids.has(r.id) && !(collection==='projects' && demoNbc.has(r.id)) && !(collection==='tasks' && demoNbc.has((r as Task).projectId??'')))]
  }
  merged.taskViews = [...current.taskViews, ...guest.taskViews.filter((v) => !current.taskViews.some((existing) => existing.id === v.id))]
  merged.scratchpad ||= guest.scratchpad
  useWorkspace.setState(normalize(merged))
  await syncWorkspace(false)
}
function applyRow(collection: CloudCollection, row: Row | null, id: string) {
  if (collection === 'profiles') {
    const data = row?.data ?? {}
    applyRemotePatch({ scratchpad: String(data.scratchpad || ''), taskViews: (data.taskViews ?? []) as Content['taskViews'], calendarPreferences: data.calendarPreferences as Content['calendarPreferences'] })
  } else {
    const list = (useWorkspace.getState()[collection] ?? []).filter((r) => r.id !== id)
    if (row) list.push({ ...row.data, ...(collection === 'projects' ? { workspace: row.data.workspace === 'team' ? 'team' : 'personal' } : {}), id, updatedAt: row.updated_at } as (typeof list)[number])
    applyRemotePatch({ [collection]: list })
  }
}
async function pullCloud(scope: string, current: number) {
  // ponytail: reconcile snapshots; use row deltas if workspace size makes this slow.
  for (const collection of [...collections, 'profiles'] as CloudCollection[]) {
    // Older deployments and ordinary projects do not need the NBC tables.
    if (collection.startsWith('nbc_') && !useWorkspace.getState().projects.some((p) => p.nbcBp03)) continue
    const rows: Row[] = []
    for (let offset = 0; ; offset += 1000) {
      let query = supabase!.from(`kw_${collection}`).select('id,data,updated_at')
      // RLS returns the caller's private projects plus the one shared NBC project.
      if (collection !== 'projects' && !collection.startsWith('nbc_')) query = query.eq('user_id', scope)
      const result = await query.order('id').range(offset, offset + 999)
      if (result.error) throw result.error
      if (current !== generation) return
      rows.push(...result.data)
      if (result.data.length < 1000) break
    }
    for (const row of rows) if (!pending.has(keyFor(scope, collection, row.id))) versions.set(keyFor(scope, collection, row.id), row.updated_at)
    if (collection === 'profiles') {
      if (!pending.has(keyFor(scope, collection, scope))) applyRow(collection, rows[0] ?? null, scope)
    } else {
      const merged = new Map<string, Data>(rows.map((r) => [r.id, { ...r.data, id: r.id, updatedAt: r.updated_at }]))
      for (const write of pending.values()) if (write.collection === collection) {
        if (write.remove) merged.delete(write.id)
        else merged.set(write.id, write.data as { id: string; updatedAt: string })
      }
      applyRemotePatch({ [collection]: [...merged.values()].map((r) => collection === 'projects' ? { ...r, workspace: r.workspace === 'team' ? 'team' : 'personal' } : r) } as Partial<Content>)
    }
  }
  hydrated = true
}
function recoverConflict(write: Write) {
  const state = useWorkspace.getState()
  const title = `Recovered edit · ${write.data.title || write.data.name || write.collection}`
  const id = state.addPage(title)
  state.updatePage(id, write.collection === 'pages' ? { ...write.data, id, title, parentId: null, deletedAt: null } as Partial<WorkspacePage> : {
    blocks: [{ id: crypto.randomUUID(), kind: 'paragraph', text: JSON.stringify(write.data, null, 2) }],
  })
  useWorkspaceUI.getState().notify('A concurrent edit was kept in the cloud. Your draft is preserved in a Recovered edit page; find it in Search.')
}
/** No routine workspace polling: fetch on subscribe/reconnect, change events, and explicit retry. */
export function syncWorkspace(refresh = true): Promise<void> {
  if (!supabase || !useAccount.getState().session || useWorkspace.getState().scope === 'guest') return Promise.resolve()
  refreshRequested ||= refresh
  if (activeRun) return activeRun
  if (!navigator.onLine) { useWorkspace.setState({ sync: { kind: 'offline', pending: pending.size } }); return Promise.resolve() }
  clearTimeout(retryTimer)
  const current = generation, scope = useWorkspace.getState().scope
  const valid = () => current === generation && scope === useAccount.getState().session?.user.id
  activeRun = (async () => {
    useWorkspace.setState({ sync: { kind: 'saving' } })
    try {
      if (!hydrated || refreshRequested) { refreshRequested = false; await pullCloud(scope, current) }
      if (!valid()) return
      let conflicts = 0
      for (;;) {
        const write = [...pending.values()].find((p) => p.collection !== 'events' || eventWriteReady(p.data as unknown as CalendarEvent))
        if (!write) break
        if (write.remove) {
          if (!['pages', 'tasks'].includes(write.collection)) throw new Error('Only trashed pages and tasks can be permanently deleted.')
          let remote: Row | null = null
          if (write.base) {
            const removed = await supabase!.from(`kw_${write.collection}`).delete().eq('user_id', scope).eq('id', write.id).eq('updated_at', write.base).select('id')
            if (!valid()) return
            if (removed.error) throw removed.error
            if (!removed.data.length) {
              const result = await supabase!.from(`kw_${write.collection}`).select('id,data,updated_at').eq('user_id', scope).eq('id', write.id).maybeSingle()
              if (!valid()) return
              if (result.error) throw result.error
              remote = result.data as Row | null
            }
          } else {
            const result = await supabase!.from(`kw_${write.collection}`).select('id,data,updated_at').eq('user_id', scope).eq('id', write.id).maybeSingle()
            if (!valid()) return
            if (result.error) throw result.error
            remote = result.data as Row | null
          }
          pending.delete(write.key)
          if (remote) versions.set(write.key, remote.updated_at)
          else versions.delete(write.key)
          if (remote) useWorkspaceUI.getState().notify('An item changed in another session and was kept. Review it before deleting again.')
          applyRow(write.collection, remote, write.id)
          void db.outbox.delete(write.key).catch(() => {})
          cacheSnapshot(scope)
          continue
        }
        const google = write.collection === 'events' ? await import('@/calendar/google') : null
        if (google && !google.useCalendars.getState().calendars.length && write.data.calendarId) await google.syncGoogle()
        if (!valid()) return
        const payload = google ? await google.pushGoogleEvent(write.data as unknown as CalendarEvent) : await syncWorkspaceFiles(write.data, scope)
        if (!valid()) return
        const { data, error } = await supabase!.rpc('kw_workspace_write', { collection: write.collection, record_id: write.id, payload, expected: write.base })
        if (!valid()) return
        if (error && write.collection === 'nbc_submissions' && ['P0001', '23505', '23514'].includes(error.code)) {
          // Preserve rejected autosaves for recovery without retrying an invalid draft forever.
          const saved = await supabase!.from('kw_nbc_submissions').select('id,data,updated_at').eq('id', write.id).maybeSingle()
          if (!valid()) return
          if (saved.error) throw saved.error
          recoverConflict(pending.get(write.key)!)
          pending.delete(write.key)
          applyRow(write.collection, saved.data as Row | null, write.id)
          refreshRequested = true
          useWorkspaceUI.getState().notify(`Draft could not be saved: ${error.message}. Your edits were preserved in Search.`)
          cacheSnapshot(scope)
          continue
        }
        if (error) throw error
        const latest = pending.get(write.key)!
        const row = data.row as Row | null
        if (data.conflict) {
          if (++conflicts > 8) throw new Error('This item is changing in another session. Your edits are retained; retry shortly.')
          if (latest.remove) {
            pending.delete(write.key)
            if (row) versions.set(write.key, row.updated_at)
            applyRow(write.collection, row, write.id)
            useWorkspaceUI.getState().notify('An item changed in another session and was kept. Review it before deleting again.')
            cacheSnapshot(scope)
            continue
          }
          const rebased = rebaseWrite(write.original, latest.data, row?.data ?? null)
          if (rebased.conflicts) {
            recoverConflict(latest)
            pending.delete(write.key)
            applyRow(write.collection, row, write.id)
          } else {
            pending.set(write.key, { ...latest, data: rebased.data, original: row!.data, base: row!.updated_at })
          }
        } else {
          if (!row) throw new Error('The server did not confirm this write.')
          versions.set(write.key, row.updated_at)
          if (latest.version === write.version) {
            pending.delete(write.key)
            applyRow(write.collection, row, write.id)
          } else {
            // Preserve keystrokes entered while the server request was in flight.
            pending.set(write.key, { ...latest, data: { ...row.data, ...changedFields(write.data, latest.data) }, original: row.data, base: row.updated_at })
          }
          if (google) await google.acknowledgeGoogleEvent(write.data as unknown as CalendarEvent)
        }
        // Remove only legacy entries that have now received a server decision.
        void db.outbox.delete(write.key).catch(() => {})
        cacheSnapshot(scope)
      }
      if (refreshRequested) { refreshRequested = false; await pullCloud(scope, current) }
      if (!valid()) return
      retry = 0
      useWorkspace.setState({ sync: pending.size ? { kind: 'saving' } : live ? { kind: 'saved' } : { kind: 'error', reason: 'Cloud loaded; live updates are connecting. Check Realtime configuration if this persists.' } })
      cacheSnapshot(scope)
    } catch (error) {
      if (!valid()) return
      useWorkspace.setState({ sync: { kind: 'error', reason: error instanceof Error ? error.message : 'Server write failed. Pending edits are retained; retry to save.' } })
      retry++
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => void syncWorkspace(), Math.min(60000, 1000 * 2 ** Math.min(retry, 6)))
    } finally {
      if (valid()) {
        activeRun = undefined
        const delayed = [...pending.values()].filter((p) => p.collection === 'events' && !eventWriteReady(p.data as unknown as CalendarEvent))
        if (!retry && delayed.length) {
          const at = Math.min(...delayed.map((p) => Date.parse(String(p.data.deleteAfter))))
          retryTimer = setTimeout(() => void syncWorkspace(false), Math.max(0, at - Date.now()))
        } else if (!retry && (refreshRequested || pending.size)) queueMicrotask(() => void syncWorkspace(false))
      }
    }
  })()
  return activeRun
}
export function applyRemotePatch(patch: Partial<Content>) {
  applying = true
  try { useWorkspace.setState(patch) } finally { applying = false }
}
