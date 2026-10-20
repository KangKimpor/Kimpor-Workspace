import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
  journal: new Map<string, string>(),
  notify: vi.fn(),
  invalidations: vi.fn(),
}))
vi.mock('@/data/sync', () => ({
  useAccount: { getState: () => ({ session: { user: { id: 'owner' } } }) },
  applyRemotePatch: vi.fn(),
}))
vi.mock('@/data/persistence', () => ({
  db: {
    versions: {
      get: async (key: string) =>
        state.journal.has(key)
          ? { key, value: state.journal.get(key) }
          : undefined,
      put: async (row: { key: string; value: string }) => {
        state.journal.set(row.key, row.value)
      },
      delete: async (key: string) => {
        state.journal.delete(key)
      },
    },
  },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => {
          state.invalidations()
          return { error: null }
        },
      }),
    }),
  },
}))
vi.mock('@/shell/workspace', () => ({
  useWorkspaceUI: { getState: () => ({ notify: state.notify }) },
}))
import {
  pushGoogleEvent,
  clearGoogleSession,
  acknowledgeGoogleEvent,
} from '@/calendar/google'
import { useCalendars } from '@/calendar/store'
import type { CalendarEvent, UserCalendar } from '@/data'
const calendar: UserCalendar = {
  id: 'calendar',
  accountId: 'account',
  providerId: 'remote',
  name: 'Work',
  color: 'blue',
  visible: true,
  accessRole: 'owner',
}
const master = {
  id: 'master',
  etag: 'master-etag',
  summary: 'Review',
  start: { date: '2026-10-19' },
  end: { date: '2026-10-20' },
  recurrence: ['RRULE:FREQ=DAILY;COUNT=5'],
}
const event: CalendarEvent = {
  id: 'occurrence',
  providerEventId: 'master_20261021',
  recurringEventId: 'master',
  title: 'Updated',
  calendarId: 'calendar',
  calendar: 'Work',
  color: 'blue',
  location: '',
  date: '2026-10-21',
  endDate: '2026-10-21',
  start: '00:00',
  end: '23:59',
  allDay: true,
  originalStartTime: '2026-10-21',
  updatedAt: '2026-10-20T02:00:00Z',
  recurrenceEdit: {
    scope: 'following',
    occurrence: '2026-10-21',
    baseDate: '2026-10-21',
    baseEndDate: '2026-10-21',
    changedFields: ['title'],
  },
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  state.journal.clear()
  vi.clearAllMocks()
  clearGoogleSession()
  useCalendars.setState({ calendars: [calendar] })
})
afterEach(() => vi.unstubAllGlobals())
test('following is durable across an interrupted truncate and reuses the created series', async () => {
  let interrupted = true,
    created = 0,
    truncated = 0
  const requests: { url: string; init: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      if (url.startsWith('/api/'))
        return new Response(
          JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
        )
      if (init.method === 'POST') {
        created++
        const body = JSON.parse(init.body as string)
        expect(body.recurrence).toEqual(['RRULE:FREQ=DAILY;COUNT=3'])
        return new Response(
          JSON.stringify({ ...master, ...body, etag: 'created-etag' }),
        )
      }
      if (init.method === 'PATCH') {
        truncated++
        if (interrupted) {
          interrupted = false
          throw new TypeError('Connection interrupted')
        }
        expect(JSON.parse(init.body as string).recurrence).toEqual([
          'RRULE:FREQ=DAILY;UNTIL=20261020',
        ])
        return new Response(JSON.stringify(master))
      }
      return new Response(JSON.stringify(master))
    }),
  )
  await expect(pushGoogleEvent(event)).rejects.toThrow('Connection interrupted')
  const result = await pushGoogleEvent(event)
  expect(created).toBe(1)
  expect(truncated).toBe(2)
  expect(result.isSeriesMaster).toBe(true)
  await pushGoogleEvent(event)
  expect(created).toBe(1)
  expect(truncated).toBe(2)
  expect(state.invalidations).toHaveBeenCalledTimes(2)
  await acknowledgeGoogleEvent(event)
  expect(state.journal.size).toBe(0)
  expect(
    requests.filter((r) => r.init.method === 'PATCH')[0]?.init.headers,
  ).toHaveProperty('If-Match', 'master-etag')
})
test('all updates the master once and preserves the original first occurrence', async () => {
  let patches = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith('/api/'))
        return new Response(
          JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
        )
      if (init.method === 'PATCH') {
        patches++
        const body = JSON.parse(init.body as string)
        expect(body.start).toEqual({ date: '2026-10-19' })
        expect(body.recurrence).toEqual(master.recurrence)
        return new Response(JSON.stringify({ ...master, ...body }))
      }
      return new Response(JSON.stringify(master))
    }),
  )
  await pushGoogleEvent({
    ...event,
    recurrenceEdit: { ...event.recurrenceEdit!, scope: 'all' },
  })
  expect(patches).toBe(1)
})
test('following deletion truncates the original without creating a replacement', async () => {
  const methods: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith('/api/'))
        return new Response(
          JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
        )
      methods.push(init.method || 'GET')
      return new Response(JSON.stringify(master))
    }),
  )
  const result = await pushGoogleEvent({
    ...event,
    deletedAt: '2026-10-20T02:00:00Z',
  })
  expect(methods).toEqual(['GET', 'PATCH'])
  expect(result.deletedAt).toBeTruthy()
})

test('stale all-series deletion loads the newer Google version without deleting it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith('/api/'))
        return new Response(
          JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
        )
      if (init.method === 'DELETE') return new Response('{}', { status: 412 })
      return new Response(
        JSON.stringify({ ...master, summary: 'Newer version' }),
      )
    }),
  )
  const result = await pushGoogleEvent({
    ...event,
    deletedAt: '2026-10-20T02:00:00Z',
    recurrenceEdit: { ...event.recurrenceEdit!, scope: 'all' },
  })
  expect(result.title).toBe('Newer version')
  expect(result.deletedAt).toBeFalsy()
  expect(state.notify).toHaveBeenCalledWith(
    expect.stringContaining('Deletion was cancelled'),
  )
})

test('a conflicting split rolls back only its own replacement with an ETag', async () => {
  const deletes: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith('/api/'))
        return new Response(
          JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
        )
      if (init.method === 'POST')
        return new Response(
          JSON.stringify({ ...master, id: 'replacement', etag: 'own-etag' }),
        )
      if (init.method === 'PATCH') return new Response('{}', { status: 412 })
      if (init.method === 'DELETE') {
        deletes.push(init)
        return new Response(null, { status: 204 })
      }
      return new Response(
        JSON.stringify({ ...master, summary: 'Latest Google version' }),
      )
    }),
  )
  const result = await pushGoogleEvent(event)
  expect(deletes).toHaveLength(1)
  expect(deletes[0]!.headers).toHaveProperty('If-Match', 'own-etag')
  expect(result.title).toBe('Latest Google version')
  expect(result.deletedAt).toBeFalsy()
})

test.each([false, true])(
  'remote deletion is recreated only by explicit Undo (%s)',
  async (restoreDeleted) => {
    let created = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.startsWith('/api/'))
          return new Response(
            JSON.stringify({ access_token: 'ephemeral', expires_in: 3600 }),
          )
        if (init.method === 'PATCH') return new Response('{}', { status: 410 })
        if (init.method === 'POST') {
          created++
          return new Response(JSON.stringify(master))
        }
        return new Response(JSON.stringify(master))
      }),
    )
    const result = await pushGoogleEvent({
      ...event,
      recurrenceEdit: undefined,
      restoreDeleted,
    })
    expect(created).toBe(restoreDeleted ? 1 : 0)
    expect(Boolean(result.deletedAt)).toBe(!restoreDeleted)
  },
)
