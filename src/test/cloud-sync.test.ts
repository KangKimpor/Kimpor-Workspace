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
    row(collection: string, id: string, data: Record<string, unknown>) { const row = { id, data: { ...data, id }, updated_at: String(++sequence) }; records.set(`${state.scope}:${collection}:${id}`, row); return row },
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
      let scope = ''
      const query = { select: () => query, eq: (_key: string, value: string) => { scope = value; return query }, order: () => query,
        range: async (start: number, end: number) => ({ error: null, data: [...records.entries()].filter(([key]) => key.startsWith(`${scope}:${table.slice(3)}:`)).map(([, row]) => structuredClone(row)).slice(start, end + 1) }),
      }
      return query
    }),
    rpc: vi.fn(async (_name: string, args: { collection: string; record_id: string; payload: Record<string, unknown>; expected: string | null }) => {
      const scope = state.scope, gate = state.gate
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
vi.mock('@/data/persistence', () => ({
  collections: ['pages', 'projects', 'tasks', 'events'], eventWriteReady: () => true,
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
  expect(registrations.filter(([type]) => type === 'postgres_changes').every(([, filter]) => filter.filter === 'user_id=eq.account-a' && filter.event !== 'DELETE')).toBe(true)
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
  cloud.state.gate = new Promise<void>((resolve) => { release = resolve })
  useWorkspace.getState().updateProject('project', { name: 'Account A pending' })
  await waitFor(() => expect(cloud.client.rpc.mock.calls.at(-1)?.[1].payload.name).toBe('Account A pending'))
  const oldHandler = cloud.state.handlers[0]!
  cloud.state.switch('account-b')
  await waitFor(() => expect(useWorkspace.getState().scope).toBe('account-b'))
  expect(useWorkspace.getState().projects).toEqual([])
  cloud.state.gate = null; release(); oldHandler()
  await waitFor(() => expect(useWorkspace.getState().sync.kind).toBe('saved'))
  expect(useWorkspace.getState().projects).toEqual([])
  expect(cloud.client.removeChannel).toHaveBeenCalled()
  expect(useAccount.getState().session?.user.id).toBe('account-b')
  cloud.state.switch(null)
  await waitFor(() => expect(useWorkspace.getState().scope).toBe('guest'))
})
