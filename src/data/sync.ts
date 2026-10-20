import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, initializeSupabase, hasStoredSession } from '@/lib/supabase'
import { useWorkspaceUI } from '@/shell/workspace'
import { contentOf, emptyContent, useWorkspace } from './index'
import {
  collections,
  db,
  flushLocal,
  persist,
  eventWriteReady,
} from './persistence'
import type { Collection, Content } from './persistence'
import { syncWorkspaceFiles } from './files'

export const useAccount = create<{
  session: Session | null
  ready: boolean
  error: string
  recovering: boolean
}>(() => ({ session: null, ready: false, error: '', recovering: false }))
let syncing = false
let applying = false
let scopeGeneration = 0
let retry = 0
let debounce: ReturnType<typeof setTimeout>
let refresh: ReturnType<typeof setTimeout>
const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('kw-updates')
    : null

export async function initializeData() {
  try {
    const guest = await db.snapshots.get('guest')
    if (guest && !localStorage.getItem('kw-workspace-v1'))
      useWorkspace.setState({
        ...guest.content,
        taskViews: guest.content.taskViews ?? [],
      })
  } catch {
    useWorkspace.setState({ storageError: true })
  }
  useWorkspace.subscribe((state, previous) => {
    if (
      !applying &&
      state.scope !== 'guest' &&
      (collections.some((c) => state[c] !== previous[c]) ||
        state.scratchpad !== previous.scratchpad ||
        state.taskViews !== previous.taskViews ||
        state.calendarPreferences !== previous.calendarPreferences)
    ) {
      clearTimeout(debounce)
      debounce = setTimeout(() => void syncWorkspace(), 600)
    }
  })
  addEventListener('online', () => void syncWorkspace())
  addEventListener('focus', () => void syncWorkspace())
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncWorkspace()
  })
  channel?.addEventListener('message', () => void reloadLocal())
  if (
    hasStoredSession() ||
    /^\/settings\/(account|accounts)/.test(location.pathname)
  )
    await initializeCloud()
  else useAccount.setState({ ready: true })
}
let cloudInitialization: Promise<void> | undefined
export function initializeCloud() {
  if (cloudInitialization) return cloudInitialization
  useAccount.setState({ ready: false, error: '' })
  cloudInitialization = (async () => {
    const client = await initializeSupabase()
    if (!client) {
      useAccount.setState({ ready: true })
      return
    }
    client.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY')
        useAccount.setState({ recovering: true })
      setTimeout(() => void switchAccount(session), 0)
    })
    const { data, error } = await client.auth.getSession()
    if (error) useAccount.setState({ error: error.message })
    await switchAccount(data.session)
    useAccount.setState({ ready: true })
  })().catch((error) => {
    cloudInitialization = undefined
    useAccount.setState({
      ready: true,
      error:
        error instanceof Error
          ? error.message
          : 'Could not connect to your account.',
    })
  })
  return cloudInitialization
}
async function reloadLocal() {
  const scope = useWorkspace.getState().scope
  const snapshot = await db.snapshots.get(scope)
  if (snapshot && scope === useWorkspace.getState().scope)
    useWorkspace.setState(snapshot.content)
}
async function switchAccount(session: Session | null) {
  const scope = session?.user.id ?? 'guest'
  useAccount.setState({ session })
  if (scope === useWorkspace.getState().scope) {
    if (session) void syncWorkspace()
    return
  }
  const generation = ++scopeGeneration
  const google = await import('@/calendar/google')
  google.clearGoogleSession()
  useWorkspaceUI.setState({ taskId: null, eventId: null, commandOpen: false })
  await flushLocal()
  const snapshot = await db.snapshots.get(scope)
  if (generation !== scopeGeneration) return
  const recoveryKey =
    scope === 'guest' ? 'kw-workspace-v1' : `kw-recovery:${scope}`
  const recovery = localStorage.getItem(recoveryKey)
  let recovered: Content | null = null
  try {
    if (recovery) recovered = JSON.parse(recovery)
  } catch {
    /* Keep the IndexedDB snapshot when a recovery copy is invalid. */
  }
  const content =
    recovered ??
    snapshot?.content ??
    (scope === 'guest' ? { ...emptyContent } : structuredClone(emptyContent))
  if (recovered && scope !== 'guest') {
    await persist(scope, recovered, snapshot?.content ?? emptyContent)
    localStorage.removeItem(recoveryKey)
  }
  useWorkspace.setState({
    ...content,
    taskViews: content.taskViews ?? [],
    scope,
    storageError: false,
    sync: { kind: 'saved' },
  })
  void syncWorkspace()
}
export async function importLocalWorkspace() {
  if (!useAccount.getState().session) throw new Error('Sign in first')
  const guest = await db.snapshots.get('guest')
  const raw = localStorage.getItem('kw-workspace-v1')
  const content = guest?.content ?? (raw ? JSON.parse(raw) : null)
  if (!content) throw new Error('No local workspace to import')
  const current = useWorkspace.getState()
  const merged = contentOf(current)
  for (const c of collections) {
    const ids = new Set(current[c].map((row) => row.id))
    ;(merged[c] as { id: string }[]) = [
      ...current[c],
      ...(content[c] ?? []).filter((row: { id: string }) => !ids.has(row.id)),
    ]
  }
  merged.taskViews = [
    ...current.taskViews,
    ...(content.taskViews ?? []).filter(
      (v: { id: string }) =>
        !current.taskViews.some((existing) => existing.id === v.id),
    ),
  ]
  if (!merged.scratchpad) merged.scratchpad = content.scratchpad || ''
  const { persist } = await import('./persistence')
  await persist(current.scope, merged, contentOf(current))
  useWorkspace.setState(merged)
  await syncWorkspace()
}
export async function syncWorkspace() {
  if (syncing || !supabase || !useAccount.getState().session || document.hidden)
    return
  const scope = useWorkspace.getState().scope
  if (scope === 'guest') return
  if (!navigator.onLine) {
    useWorkspace.setState({
      sync: {
        kind: 'offline',
        pending: await db.outbox.where('scope').equals(scope).count(),
      },
    })
    return
  }
  syncing = true
  const generation = scopeGeneration
  const currentScope = () =>
    generation === scopeGeneration && scope === useWorkspace.getState().scope
  useWorkspace.setState({ sync: { kind: 'saving' } })
  try {
    await flushLocal()
    const google = await import('@/calendar/google')
    if (!google.useCalendars.getState().calendars.length)
      await google.syncGoogle()
    const pendingItems = await db.outbox.where('scope').equals(scope).toArray()
    pendingItems.sort((a, b) =>
      String(a.data.updatedAt || '').localeCompare(
        String(b.data.updatedAt || ''),
      ),
    )
    for (const pending of pendingItems) {
      if (!currentScope()) return
      if (
        pending.collection === 'events' &&
        !eventWriteReady(
          pending.data as unknown as import('./types').CalendarEvent,
        )
      )
        continue
      const payload =
        pending.collection === 'events'
          ? await google.pushGoogleEvent(
              pending.data as unknown as import('./types').CalendarEvent,
            )
          : await syncWorkspaceFiles(pending.data, scope)
      const { data, error } = await supabase.rpc('kw_workspace_write', {
        collection: pending.collection,
        record_id: pending.id,
        payload,
        expected: pending.base,
      })
      if (error) throw error
      if (data.conflict && pending.collection === 'pages' && currentScope()) {
        const state = useWorkspace.getState()
        const title = `Recovered edit · ${pending.data.title || 'Untitled'}`
        const recovered = state.addPage(title)
        state.updatePage(recovered, {
          ...pending.data,
          id: recovered,
          title,
          parentId: null,
        } as Partial<import('./types').WorkspacePage>)
      }
      await db.transaction('rw', db.outbox, db.versions, async () => {
        const latest = await db.outbox.get(pending.key)
        await db.versions.put({ key: pending.key, value: data.row.updated_at })
        if (latest?.version === pending.version)
          await db.outbox.delete(pending.key)
        else if (latest)
          await db.outbox.put({
            ...latest,
            base: data.row.updated_at,
            data:
              pending.collection === 'events' &&
              latest.data.calendarId === pending.data.calendarId
                ? {
                    ...latest.data,
                    providerEventId: data.row.data.providerEventId,
                    etag: data.row.data.etag,
                  }
                : latest.data,
          })
      })
      if (pending.collection === 'events')
        await google.acknowledgeGoogleEvent(
          pending.data as unknown as import('./types').CalendarEvent,
        )
      if (currentScope() && !(await db.outbox.get(pending.key))) {
        if (pending.collection === 'profiles')
          applyRemotePatch({
            scratchpad: data.row.data.scratchpad || '',
            taskViews: data.row.data.taskViews ?? [],
            calendarPreferences: data.row.data.calendarPreferences,
          })
        else mergeRows(pending.collection, [data.row], new Set())
        if (data.conflict)
          useWorkspaceUI
            .getState()
            .notify(
              pending.collection === 'pages'
                ? 'A newer saved change replaced an offline edit. Your version is kept in Pages as a Recovered edit.'
                : 'A newer saved change replaced an offline edit. Review the updated item.',
            )
      }
    }
    for (const collection of collections) {
      const data: {
        id: string
        data: Record<string, unknown>
        updated_at: string
      }[] = []
      for (let offset = 0; ; offset += 1000) {
        const page = await supabase
          .from(`kw_${collection}`)
          .select('id,data,updated_at')
          .eq('user_id', scope)
          .order('id')
          .range(offset, offset + 999)
        if (page.error) throw page.error
        data.push(...page.data)
        if (page.data.length < 1000) break
      }
      if (!currentScope()) return
      const pending = new Set(
        (await db.outbox.where('scope').equals(scope).toArray())
          .filter((p) => p.collection === collection)
          .map((p) => p.id),
      )
      mergeRows(collection, data ?? [], pending)
      await db.versions.bulkPut(
        (data ?? []).map((row) => ({
          key: `${scope}:${collection}:${row.id}`,
          value: row.updated_at,
        })),
      )
    }
    const profile = await supabase
      .from('kw_profiles')
      .select('data,updated_at')
      .eq('id', scope)
      .maybeSingle()
    if (profile.error) throw profile.error
    const profileKey = `${scope}:profiles:${scope}`
    if (currentScope() && profile.data && !(await db.outbox.get(profileKey))) {
      applyRemotePatch({
        scratchpad: profile.data.data.scratchpad || '',
        taskViews: profile.data.data.taskViews ?? [],
        calendarPreferences: profile.data.data.calendarPreferences,
      })
      await db.versions.put({
        key: profileKey,
        value: profile.data.updated_at,
      })
    }
    if (currentScope()) {
      await google.syncGoogle()
      await db.snapshots.put({
        scope,
        content: contentOf(useWorkspace.getState()),
      })
      useWorkspace.setState({
        sync: {
          kind: (await db.outbox.where('scope').equals(scope).count())
            ? 'saving'
            : 'saved',
        },
      })
      channel?.postMessage({ scope })
      retry = 0
    }
  } catch (error) {
    retry++
    if (currentScope())
      useWorkspace.setState({
        sync: {
          kind: 'error',
          reason:
            error instanceof Error
              ? error.message
              : 'Sync failed. Your offline edits are retained.',
        },
      })
  } finally {
    syncing = false
    clearTimeout(refresh)
    refresh = setTimeout(
      () => void syncWorkspace(),
      retry
        ? Math.min(60000, 1000 * 2 ** retry) + Math.random() * 1000
        : (await db.outbox.where('scope').equals(scope).count())
          ? 1000
          : 30000,
    )
  }
}
function mergeRows(
  collection: Collection,
  rows: { id: string; data: Record<string, unknown>; updated_at: string }[],
  pending: Set<string>,
) {
  const current = useWorkspace.getState()[collection]
  const merged = new Map(current.map((row) => [row.id, row]))
  for (const row of rows)
    if (!pending.has(row.id) && row.data && row.data.id === row.id)
      merged.set(row.id, {
        ...row.data,
        updatedAt: row.updated_at,
      } as (typeof current)[number])
  applyRemotePatch({ [collection]: [...merged.values()] } as Partial<Content>)
}
export function applyRemotePatch(patch: Partial<Content>) {
  applying = true
  useWorkspace.setState(patch)
  applying = false
}
