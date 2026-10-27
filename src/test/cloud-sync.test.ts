import { expect, test, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
const cloud = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, unknown>; updated_at: string }
  const records = new Map<string, Row>()
  let authChange: (event: string, session: unknown) => void = () => {}
  let sequence = 0
  const session = (id: string) => ({ user: { id }, access_token: `token-${id}` })
  const state = { scope: 'account-a', gate: null as Promise<void> | null, handlers: [] as (() => void)[], records, session,
    switch(id: string | null) { state.scope = id || ''; authChange('SIGNED_IN', id ? session(id) : null) },
    row(collection: string, id: string, data: Record<string, unknown>, owner?: string): Row { const row = { id, data: { ...data, id }, updated_at: String(++sequence) }; records.set(`${owner ?? state.scope}:${collection}:${id}`, row); return row },
  }
  const client = {
    auth: { onAuthStateChange: vi.fn((fn) => { authChange = fn }), getSession: vi.fn(async () => ({ data: { session: session(state.scope) }, error: null })) },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => {
      const channel = { on: vi.fn((_type, _filter, fn) => { state.handlers.push(fn); return channel }), subscribe: vi.fn((fn) => { queueMicrotask(() => fn('SUBSCRIBED')); return channel }) }
      return channel
    }),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => {
      const caller = state.scope
      let scope = '', id = '', expected = '', removing = false
      const visible = () => [...records.entries()].filter(([key,row]) => {
        if (scope) return key.startsWith(`${scope}:${table.slice(3)}:`)
        if (!key.includes(`:${table.slice(3)}:`)) return false
        if (table === 'kw_projects') return key.startsWith(`${caller}:`) || row.data.nbcBp03 === true
        const company = [...records.entries()].find(([key,row]) => key.includes(':projects:') && row.data.nbcBp03 === true)?.[0].split(':')[0]
        return table.startsWith('kw_nbc_') && key.startsWith(`${company}:`)
      }).map(([,row]) => row)
      const query = { select: () => query, delete: () => { removing = true; return query }, eq: (key: string, value: string) => { if (key === 'id') id = value; else if (key === 'updated_at') expected = value; else scope = value; return query }, order: () => query,
        // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are awaitable.
        then: async (resolve: (value: { error: null; data: { id: string }[] }) => unknown) => {
          const key = `${scope}:${table.slice(3)}:${id}`, row = records.get(key)
          const removed = removing && row?.updated_at === expected
          if (removed) records.delete(key)
          return resolve({ error: null, data: removed ? [{ id }] : [] })
        },
        maybeSingle: async () => ({ error: null, data: visible().find((row)=>row.id===id) ?? null }),
        range: async (start: number, end: number) => ({ error: null, data: visible().map((row)=>structuredClone(row)).slice(start, end + 1) }),
      }
      return query
    }),
    rpc: vi.fn(async (_name: string, args: { collection: string; record_id: string; payload: Record<string, unknown>; expected: string | null }) => {
      const actor = state.scope, scope = args.collection?.startsWith('nbc_') ? [...records.entries()].find(([key,row])=>key.includes(':projects:')&&row.data.nbcBp03===true)?.[0].split(':')[0] ?? actor : actor, gate = state.gate
      if (gate) await gate
      const key = `${scope}:${args.collection}:${args.record_id}`, existing = records.get(key)
      if ((existing && existing.updated_at !== args.expected) || (!existing && args.expected)) return { error: null, data: { conflict: true, row: existing ? structuredClone(existing) : null } }
      const row = { id: args.record_id, data: structuredClone(args.payload), updated_at: String(++sequence) }
      records.set(key, row)
      return { error: null, data: { conflict: false, row } }
    }),
  }
  return { ...state, state, client }
})
vi.mock('@/lib/supabase', () => ({ supabase: cloud.client, hasStoredSession: () => true, initializeSupabase: async () => cloud.client }))
vi.mock('@/data/persistence', async () => ({
  ...await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence'),
  collections: ['pages', 'projects', 'tasks', 'events', 'nbc_activities', 'nbc_submissions', 'nbc_summaries'], eventWriteReady: () => true,
  db: { snapshots: { get: async () => { throw Error('IndexedDB disabled') }, put: async () => { throw Error('IndexedDB disabled') } }, outbox: { where: () => ({ equals: () => ({ toArray: async () => { throw Error('IndexedDB disabled') } }) }), delete: async () => {} } },
}))
vi.mock('@/calendar/google', () => ({ clearGoogleSession: vi.fn(), syncGoogle: vi.fn(async () => {}), useCalendars: { getState: () => ({ calendars: [] }) } }))
vi.mock('@/data/files', () => ({ syncWorkspaceFiles: async (data: unknown) => data }))

test('cloud writes need no local database, retain in-flight edits, refresh live, merge conflicts and isolate switched accounts', async () => {
  const { useWorkspace } = await import('@/data')
  const { initializeData, useAccount } = await import('@/data/sync')
  const original = { id: 'project', name: 'Cloud project', description: '', color: 'blue', progress: 0, target: '', workspace: 'personal' }
  cloud.state.row('projects', 'project', original)
  localStorage.setItem('kw-recovery:account-a', JSON.stringify({ pages: [{ id: 'legacy-page', title: 'Legacy recovery', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null }], projects: [], tasks: [], events: [], scratchpad: '', taskViews: [] }))
  await initializeData()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().projects[0]?.name).toBe('Cloud project')
  await waitFor(() => expect(cloud.state.records.get('account-a:pages:legacy-page')?.data.title).toBe('Legacy recovery'))
  expect(cloud.client.channel).toHaveBeenCalledWith('kw-workspace:account-a', { config: { private: true } })
  const registrations = cloud.client.channel.mock.results[0]!.value.on.mock.calls as [string, { filter?: string; event?: string }][]
  expect(registrations.filter(([type]) => type === 'postgres_changes').every(([, filter]) => ((filter as {table?:string}).table==='kw_projects' ? !filter.filter : filter.filter === 'user_id=eq.account-a') && filter.event !== 'DELETE')).toBe(true)
  expect(registrations.some(([type, filter]) => type === 'broadcast' && filter.event === 'DELETE')).toBe(true)

  let release!: () => void
  cloud.state.gate = new Promise<void>((resolve) => { release = resolve })
  const localFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('Storage disabled') })
  useWorkspace.getState().updateProject('project', { name: 'First keystroke' })
  await waitFor(() => expect(cloud.client.rpc).toHaveBeenCalled())
  expect(useWorkspace.getState().sync.kind).toBe('saving')
  useWorkspace.getState().updateProject('project', { name: 'Latest keystroke' })
  cloud.state.gate = null; release()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.get('account-a:projects:project')?.data.name).toBe('Latest keystroke')
  localFailure.mockRestore()
  cloud.client.rpc.mockRejectedValueOnce(new Error('Server unavailable'))
  useWorkspace.getState().updateProject('project', { name: 'Retry retained' })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('error'))
  expect(useWorkspace.getState().projects[0]?.name).toBe('Retry retained')
  const { syncWorkspace } = await import('@/data/sync')
  await syncWorkspace()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.get('account-a:projects:project')?.data.name).toBe('Retry retained')
  // The change arrives through the channel without focus or a timer.
  cloud.state.row('projects', 'project', { ...original, name: 'Another session' })
  cloud.state.handlers[0]!()
  await waitFor(() => expect(useWorkspace.getState().projects[0]?.name).toBe('Another session'))
  // A remote change to a different field is rebased rather than overwritten.
  cloud.state.row('projects', 'project', { ...original, name: 'Another session', description: 'Remote description' })
  useWorkspace.getState().updateProject('project', { name: 'Concurrent local name' })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.get('account-a:projects:project')?.data).toMatchObject({ name: 'Concurrent local name', description: 'Remote description' })
  // A remotely deleted row is never recreated by a stale write.
  cloud.state.records.delete('account-a:projects:project')
  useWorkspace.getState().updateProject('project', { name: 'Retain this draft' })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.has('account-a:projects:project')).toBe(false)
  expect(useWorkspace.getState().pages.some((p) => JSON.stringify(p.blocks).includes('Retain this draft'))).toBe(true)
  cloud.state.row('projects', 'project', original)
  cloud.state.handlers[0]!()
  await waitFor(() => expect(useWorkspace.getState().projects).toHaveLength(1))
  const { fixtureActivities, fixtureProject } = await import('@/nbc/test-fixture')
  const { saveDraft } = await import('@/nbc/actions')
  const { draftEntries } = await import('@/nbc/submission-actions')
  const { weekStart } = await import('@/nbc/submissions')
  const week = weekStart()
  cloud.state.row('projects', fixtureProject.id, fixtureProject)
  for (const activity of fixtureActivities()) cloud.state.row('nbc_activities', activity.id, activity as unknown as Record<string, unknown>)
  cloud.state.handlers[0]!()
  await waitFor(() => expect(useWorkspace.getState().nbc_activities).toHaveLength(4))
  saveDraft(week,'Tola',draftEntries(week,'Tola').map((e)=>({...e,progress:e.activityId==='nbc:1.6.1.2'?.5:e.progress})),'Saved through existing cloud queue')
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  const reportId=useWorkspace.getState().nbc_submissions![0]!.id
  expect(cloud.state.records.get(`account-a:nbc_submissions:${reportId}`)?.data.status).toBe('draft')
  expect(cloud.state.records.get('account-a:nbc_activities:nbc:1.6.1.2')?.data.progress).toBe(.25)
  cloud.client.rpc.mockImplementationOnce(async () => ({ error: { code: 'P0001', message: 'Assignments changed' }, data: null }) as never)
  saveDraft(week,'Tola',draftEntries(week,'Tola'),'Rejected draft kept for recovery')
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().pages.some((p) => JSON.stringify(p.blocks).includes('Rejected draft kept for recovery'))).toBe(true)
  const disposable = useWorkspace.getState().addTask({ title: 'Disposable task', projectId: 'project' })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  const notesId = useWorkspace.getState().tasks.find((task) => task.id === disposable)!.pageId!
  useWorkspace.getState().trashTask(disposable)
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  // Legacy trashed tasks may still have an active notes page. Empty Trash must purge it too.
  useWorkspace.setState({ pages: useWorkspace.getState().pages.map((page) => page.id === notesId ? { ...page, deletedAt: null } : page) })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  useWorkspace.getState().emptyTrash()
  expect(useWorkspace.getState().tasks.some((task) => task.id === disposable)).toBe(false)
  expect(Object.keys(localStorage).some((key) => key.startsWith('kw-cloud-pending:account-a:') && localStorage.getItem(key)?.includes('"remove":true'))).toBe(true)
  offline.mockRestore()
  await syncWorkspace()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.has(`account-a:tasks:${disposable}`)).toBe(false)
  expect(cloud.state.records.has(`account-a:pages:${notesId}`)).toBe(false)
  const changedTask = useWorkspace.getState().addTask({ title: 'Review before permanent delete', projectId: 'project' })
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  useWorkspace.getState().trashTask(changedTask)
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  const remoteTask = cloud.state.records.get(`account-a:tasks:${changedTask}`)!
  cloud.state.row('tasks', changedTask, { ...remoteTask.data, title: 'Changed remotely' })
  useWorkspace.getState().emptyTrash()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().tasks.find((task) => task.id === changedTask)?.title).toBe('Changed remotely')
  useWorkspace.getState().emptyTrash()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.has(`account-a:tasks:${changedTask}`)).toBe(false)
  cloud.state.gate = new Promise<void>((resolve) => { release = resolve })
  useWorkspace.getState().updateProject('project', { name: 'Account A pending' })
  await waitFor(() => expect(cloud.client.rpc.mock.calls.at(-1)?.[1].payload.name).toBe('Account A pending'))
  const oldHandler = cloud.state.handlers[0]!
  cloud.state.switch('account-b')
  await waitFor(() => expect(useWorkspace.getState().scope).toBe('account-b'))
  expect(useWorkspace.getState().projects.some((p)=>p.id==='project')).toBe(false)
  expect(useWorkspace.getState().tasks).toEqual([])
  cloud.state.gate = null; release(); oldHandler()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().projects.map((p)=>p.id)).toEqual([fixtureProject.id])
  expect(useWorkspace.getState().nbc_activities).toHaveLength(4)
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(1)
  expect(cloud.client.removeChannel).toHaveBeenCalled()
  expect(useAccount.getState().session?.user.id).toBe('account-b')
  // A second account edits the canonical rows; a brand-new account sees that exact update.
  saveDraft(week,'Tola',draftEntries(week,'Tola').map((e)=>({...e,progress:e.activityId==='nbc:1.6.1.2'?.875:e.progress})),'Second account draft')
  await waitFor(()=>expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(cloud.state.records.get(`account-a:nbc_submissions:${reportId}`)?.data.note).toBe('Second account draft')
  expect(cloud.state.records.has(`account-b:nbc_submissions:${reportId}`)).toBe(false)
  cloud.state.switch('brand-new-account')
  await waitFor(()=>expect(useWorkspace.getState().scope).toBe('brand-new-account'))
  await waitFor(()=>expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().projects.map((p)=>p.id)).toEqual([fixtureProject.id])
  expect(useWorkspace.getState().nbc_activities!.find((a)=>a.wbs==='1.6.1.2')?.progress).toBe(.25)
  expect(useWorkspace.getState().nbc_submissions!.find((r)=>r.status==='draft')?.note).toBe('Second account draft')
  expect(useWorkspace.getState().tasks).toEqual([])
  expect(useWorkspace.getState().pages).toEqual([])
  cloud.state.switch(null)
  await waitFor(() => expect(useWorkspace.getState().scope).toBe('guest'))
})
