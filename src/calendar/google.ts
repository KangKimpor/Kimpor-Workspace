import { supabase } from '@/lib/supabase'
import { applyRemotePatch, useAccount } from '@/data/sync'
import { dateKey, useWorkspace } from '@/data'
import type { CalendarAccount, CalendarEvent, UserCalendar } from '@/data'
import { db } from '@/data/persistence'
import { useWorkspaceUI } from '@/shell/workspace'
import { zonedDate } from './time'
import { TZDate } from '@date-fns/tz'
import { dayDifference, shiftDay, splitRule } from './recurrence'
import { useCalendars } from './store'
import { googleEventColors } from './colors'
export { useCalendars } from './store'

export interface CalendarProvider {
  listCalendars(account: CalendarAccount): Promise<UserCalendar[]>
  sync(
    calendar: UserCalendar,
  ): Promise<{ events: CalendarEvent[]; token: string; reset: boolean }>
  create(calendar: UserCalendar, event: CalendarEvent): Promise<CalendarEvent>
  update(calendar: UserCalendar, event: CalendarEvent): Promise<CalendarEvent>
  delete(calendar: UserCalendar, event: CalendarEvent): Promise<void>
}
const tokenCache = new Map<string, { token: string; until: number }>()
const retries = new Map<
  string,
  { attempt: number; until: number; message: string }
>()
function backoff(key: string, error: unknown) {
  const attempt = (retries.get(key)?.attempt || 0) + 1
  const message = error instanceof Error ? error.message : 'Google sync failed'
  retries.set(key, {
    attempt,
    until: Date.now() + Math.min(900000, 30000 * 2 ** (attempt - 1)),
    message,
  })
  return message
}
export function clearGoogleSession() {
  tokenCache.clear()
  retries.clear()
  useCalendars.setState({
    accounts: [],
    calendars: [],
    error: '',
    busy: false,
  })
}
class GoogleError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
export async function googleService(action: string, body: object = {}) {
  const session = useAccount.getState().session
  const response = await fetch(`/api/google/${action}`, {
    method: action === 'info' ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    ...(action === 'info' ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  }).catch((error: unknown) => {
    if (
      (error instanceof Error || error instanceof DOMException) &&
      ['TimeoutError', 'AbortError'].includes(error.name)
    )
      throw new Error('The calendar service took too long. Please try again.')
    throw new Error(
      'Could not reach the calendar service. Check your connection and try again.',
    )
  })
  const data = await response.json()
  if (!response.ok)
    throw new GoogleError(
      response.status,
      data.error || 'Calendar request failed',
    )
  return data
}
async function accessToken(accountId: string) {
  const cached = tokenCache.get(accountId)
  if (cached && cached.until > Date.now()) return cached.token
  const data = await googleService('token', { accountId })
  tokenCache.set(accountId, {
    token: data.access_token,
    until: Date.now() + (Number(data.expires_in) - 60) * 1000,
  })
  return data.access_token as string
}
async function api(accountId: string, path: string, init: RequestInit = {}) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3${path}`,
    {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${await accessToken(accountId)}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!response.ok) {
    if (response.status === 401) tokenCache.delete(accountId)
    throw new GoogleError(
      response.status,
      response.status === 412
        ? 'This event changed in Google. The latest version has been loaded.'
        : response.status === 429 || response.status === 403
          ? 'Google is limiting requests. Sync will retry.'
          : 'Google Calendar request failed. Reconnect the account if it persists.',
    )
  }
  return response.status === 204 ? {} : response.json()
}
export function normalize(
  raw: Record<string, any>,
  calendar: UserCalendar,
): CalendarEvent {
  const date =
      raw.start?.date || raw.start?.dateTime?.slice(0, 10) || dateKey(),
    endDate = raw.end?.date
      ? shiftDate(raw.end.date, -1)
      : raw.end?.dateTime?.slice(0, 10) || date
  const start = raw.start?.dateTime ? new Date(raw.start.dateTime) : null,
    end = raw.end?.dateTime ? new Date(raw.end.dateTime) : null
  return {
    id: `google:${calendar.id}:${raw.id}`,
    providerEventId: raw.id,
    calendarId: calendar.id,
    title: raw.summary || 'Untitled event',
    date: start ? dateKey(start) : date,
    endDate: end ? dateKey(end) : endDate,
    start: start
      ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      : '00:00',
    end: end
      ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      : '23:59',
    allDay: !!raw.start?.date,
    // The stored clock was converted to the viewer's local time above.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sourceTimeZone: raw.start?.timeZone || calendar.timeZone,
    startInstant: raw.start?.dateTime,
    endInstant: raw.end?.dateTime,
    isSeriesMaster: !!raw.recurrence?.length,
    calendar: calendar.name,
    color:
      googleEventColors.find((color) => color.id === raw.colorId)?.palette ||
      calendar.color,
    googleColorId: raw.colorId,
    location: raw.location || '',
    meetLink:
      typeof raw.hangoutLink === 'string' &&
      /^https:\/\/meet\.google\.com\/[a-z-]+$/.test(raw.hangoutLink)
        ? raw.hangoutLink
        : undefined,
    description: raw.description || '',
    etag: raw.etag,
    recurringEventId: raw.recurringEventId,
    originalStartTime:
      raw.originalStartTime?.dateTime || raw.originalStartTime?.date,
    recurrence: raw.recurrence
      ?.find((r: string) => r.startsWith('RRULE:'))
      ?.slice(6),
    guests:
      raw.attendees
        ?.filter((a: { email?: string }) => a.email)
        .map((a: { email: string }) => a.email) || [],
    googleAttendees: raw.attendees
      ?.filter((a: { email?: string }) => a.email)
      .map((a: Record<string, unknown>) => ({
        email: a.email,
        responseStatus: a.responseStatus,
        optional: a.optional,
        comment: a.comment,
        displayName: a.displayName,
      })),
    googleReminders: raw.reminders,
    reminders: raw.reminders?.overrides
      ?.filter((r: { method: string }) => r.method === 'popup')
      .map((r: { minutes: number }) => r.minutes),
    busy: raw.transparency !== 'transparent',
    visibility: raw.visibility || 'default',
    deletedAt: raw.status === 'cancelled' ? new Date().toISOString() : null,
    updatedAt: raw.updated,
  }
}
function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return dateKey(value)
}
function eventInstant(
  date: string,
  time: string,
  zone: string,
  original?: string,
) {
  if (original) {
    const previous = new TZDate(original, zone)
    const previousClock = `${String(previous.getHours()).padStart(2, '0')}:${String(previous.getMinutes()).padStart(2, '0')}`
    // Keep the original offset when a DST fall-back repeats the same clock time.
    if (dateKey(previous) === date && previousClock === time) return original
  }
  return zonedDate(date, time, zone).toISOString()
}
export function payload(event: CalendarEvent) {
  const timeZone =
    event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const providerZone = event.sourceTimeZone || timeZone
  return {
    summary: event.title,
    start: event.allDay
      ? { date: event.date }
      : {
          dateTime: eventInstant(
            event.date,
            event.start,
            timeZone,
            event.startInstant,
          ),
          timeZone: providerZone,
        },
    end: event.allDay
      ? { date: shiftDate(event.endDate || event.date, 1) }
      : {
          dateTime: eventInstant(
            event.endDate || event.date,
            event.end,
            timeZone,
            event.endInstant,
          ),
          timeZone: providerZone,
        },
    description: event.description || '',
    location: event.location,
    transparency: event.busy === false ? 'transparent' : 'opaque',
    visibility: event.visibility || 'default',
    colorId: event.googleColorId,
    ...(event.recurrence
      ? { recurrence: [`RRULE:${event.recurrence.replace(/^RRULE:/, '')}`] }
      : {}),
    attendees: (event.guests ?? []).map(
      (email) =>
        event.googleAttendees?.find(
          (a) => a.email.toLowerCase() === email.toLowerCase(),
        ) ?? { email },
    ),
    reminders:
      event.googleReminders ??
      (event.reminders !== undefined
        ? {
            useDefault: false,
            overrides: event.reminders.map((minutes) => ({
              method: 'popup',
              minutes,
            })),
          }
        : undefined),
  }
}
export const googleProvider: CalendarProvider = {
  async listCalendars(account) {
    const result: UserCalendar[] = []
    let page = ''
    do {
      const data = await api(
        account.id,
        `/users/me/calendarList?maxResults=250${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`,
      )
      for (const c of data.items ?? [])
        result.push({
          id: '',
          accountId: account.id,
          providerId: c.id,
          name: c.summary,
          color: 'blue',
          visible: true,
          accessRole: c.accessRole,
          timeZone: c.timeZone,
        })
      page = data.nextPageToken || ''
    } while (page)
    return result
  },
  async sync(calendar) {
    let params = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '2500',
      }),
      reset = calendar.eventFormatVersion !== 2
    if (calendar.syncToken && !reset)
      params.set('syncToken', calendar.syncToken)
    const events: CalendarEvent[] = []
    let token = ''
    for (;;) {
      let data
      try {
        data = await api(
          calendar.accountId,
          `/calendars/${encodeURIComponent(calendar.providerId)}/events?${params}`,
        )
      } catch (error) {
        if (error instanceof GoogleError && error.status === 410 && !reset) {
          params = new URLSearchParams({
            singleEvents: 'true',
            showDeleted: 'true',
            maxResults: '2500',
          })
          events.length = 0
          reset = true
          continue
        }
        throw error
      }
      events.push(
        ...(data.items ?? []).map((r: Record<string, unknown>) =>
          normalize(r, calendar),
        ),
      )
      if (!data.nextPageToken) {
        token = data.nextSyncToken || ''
        break
      }
      params.set('pageToken', data.nextPageToken)
    }
    return { events, token, reset }
  },
  async create(calendar, event) {
    const id = `${event.id}${event.updatedAt || ''}`
      .replace(/[^a-f0-9]/gi, '')
      .toLowerCase()
    let raw
    try {
      raw = await api(
        calendar.accountId,
        `/calendars/${encodeURIComponent(calendar.providerId)}/events`,
        { method: 'POST', body: JSON.stringify({ ...payload(event), id }) },
      )
    } catch (error) {
      if (error instanceof GoogleError && error.status === 409)
        raw = await api(
          calendar.accountId,
          `/calendars/${encodeURIComponent(calendar.providerId)}/events/${id}`,
        )
      else throw error
    }
    return { ...normalize(raw, calendar), id: event.id }
  },
  async update(calendar, event) {
    const path = `/calendars/${encodeURIComponent(calendar.providerId)}/events/${encodeURIComponent(event.providerEventId!)}`
    try {
      return {
        ...normalize(
          await api(calendar.accountId, path, {
            method: 'PATCH',
            headers: event.etag ? { 'If-Match': event.etag } : {},
            body: JSON.stringify(payload(event)),
          }),
          calendar,
        ),
        id: event.id,
      }
    } catch (error) {
      if (error instanceof GoogleError && [404, 410].includes(error.status)) {
        if (event.restoreDeleted) return googleProvider.create(calendar, event)
        useWorkspaceUI
          .getState()
          .notify(
            'This event was deleted in Google. Your offline edit did not recreate it.',
          )
        return { ...event, deletedAt: new Date().toISOString() }
      }
      if (error instanceof GoogleError && error.status === 412) {
        useWorkspaceUI.getState().notify(error.message)
        return {
          ...normalize(await api(calendar.accountId, path), calendar),
          id: event.id,
        }
      }
      throw error
    }
  },
  async delete(calendar, event) {
    try {
      await api(
        calendar.accountId,
        `/calendars/${encodeURIComponent(calendar.providerId)}/events/${encodeURIComponent(event.providerEventId!)}`,
        {
          method: 'DELETE',
          headers: event.etag ? { 'If-Match': event.etag } : {},
        },
      )
    } catch (error) {
      if (!(error instanceof GoogleError && [404, 410].includes(error.status)))
        throw error
    }
  },
}
function seriesJournalKey(event: CalendarEvent) {
  return `${useAccount.getState().session?.user.id}:google-series:${event.id}:${event.updatedAt}`
}
export async function acknowledgeGoogleEvent(event: CalendarEvent) {
  if (event.recurrenceEdit) await db.versions.delete(seriesJournalKey(event))
}
function partitionRecurrence(lines: string[], boundary: Date, zone: string) {
  const before: string[] = [],
    after: string[] = []
  for (const line of lines.filter((line) => !line.startsWith('RRULE:'))) {
    const colon = line.lastIndexOf(':'),
      prefix = line.slice(0, colon),
      values = line.slice(colon + 1).split(',')
    const earlier: string[] = [],
      later: string[] = []
    for (const value of values) {
      const match =
        /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/.exec(value)
      if (!match)
        throw new Error(
          'This series has an invalid recurrence date. Repair it in Google Calendar before splitting it.',
        )
      const [
        ,
        year,
        month,
        day,
        hour = '00',
        minute = '00',
        second = '00',
        utc,
      ] = match
      const date = `${year}-${month}-${day}`,
        time = `${hour}:${minute}`
      const instant =
        utc || !match[4]
          ? new Date(`${date}T${time}:${second}Z`)
          : zonedDate(date, time, /TZID=([^;:]+)/.exec(prefix)?.[1] || zone)
      ;(instant < boundary ? earlier : later).push(value)
    }
    if (earlier.length) before.push(`${prefix}:${earlier.join(',')}`)
    if (later.length) after.push(`${prefix}:${later.join(',')}`)
  }
  return { before, after }
}
async function invalidateGoogleCalendar(calendar: UserCalendar) {
  const next = { ...calendar, eventFormatVersion: 0, syncToken: undefined }
  const { error } = await supabase!
    .from('kw_calendars')
    .update({ data: next })
    .eq('id', calendar.id)
  if (error) throw error
  useCalendars.setState({
    calendars: useCalendars
      .getState()
      .calendars.map((c) => (c.id === calendar.id ? next : c)),
  })
}
async function changeGoogleSeries(
  calendar: UserCalendar,
  event: CalendarEvent,
): Promise<CalendarEvent> {
  const edit = event.recurrenceEdit!
  const base = `/calendars/${encodeURIComponent(calendar.providerId)}/events`
  const masterPath = `${base}/${encodeURIComponent(event.recurringEventId!)}`
  const key = seriesJournalKey(event)
  const stored = await db.versions.get(key)
  let plan: {
    master: Record<string, any>
    body?: Record<string, unknown>
    before?: string[]
    created?: Record<string, any>
    result?: CalendarEvent
  } = stored
    ? JSON.parse(stored.value)
    : { master: await api(calendar.accountId, masterPath) }
  const persistPlan = () =>
    db.versions.put({ key, value: JSON.stringify(plan) })
  if (plan.result) {
    await invalidateGoogleCalendar(calendar)
    return plan.result
  }
  const master = normalize(plan.master, calendar)
  const first = plan.master.start.date || plan.master.start.dateTime
  const boundary = new Date(
    edit.occurrence.length === 10
      ? `${edit.occurrence}T00:00:00Z`
      : edit.occurrence,
  )
  const scope =
    edit.scope === 'following' &&
    boundary.getTime() <=
      new Date(first.length === 10 ? `${first}T00:00:00Z` : first).getTime()
      ? 'all'
      : edit.scope
  await persistPlan()
  if (scope === 'all') {
    if (event.deletedAt) {
      try {
        await api(calendar.accountId, masterPath, {
          method: 'DELETE',
          headers: { 'If-Match': plan.master.etag },
        })
      } catch (error) {
        if (error instanceof GoogleError && error.status === 412) {
          plan.result = {
            ...normalize(await api(calendar.accountId, masterPath), calendar),
            id: event.id,
          }
          useWorkspaceUI
            .getState()
            .notify(
              'This series changed in Google. Deletion was cancelled; review the latest version.',
            )
        } else if (
          !(error instanceof GoogleError && [404, 410].includes(error.status))
        )
          throw error
      }
      plan.result ??= { ...event, recurrenceEdit: undefined }
    } else {
      const changed = Object.fromEntries(
        edit.changedFields.map((field) => [field, event[field]]),
      )
      const draft = { ...master, ...changed, id: event.id }
      if (edit.changedFields.includes('date'))
        draft.date = shiftDay(
          master.date,
          dayDifference(event.date, edit.baseDate),
        )
      if (edit.changedFields.includes('endDate'))
        draft.endDate = shiftDay(
          master.endDate || master.date,
          dayDifference(event.endDate || event.date, edit.baseEndDate),
        )
      const body = {
        ...payload(draft),
        recurrence: edit.changedFields.includes('recurrence')
          ? draft.recurrence
            ? [`RRULE:${draft.recurrence}`]
            : []
          : plan.master.recurrence,
      }
      try {
        const response = await api(calendar.accountId, masterPath, {
          method: 'PATCH',
          headers: { 'If-Match': plan.master.etag },
          body: JSON.stringify(body),
        })
        plan.result = { ...normalize(response, calendar), id: event.id }
      } catch (error) {
        if (!(error instanceof GoogleError && error.status === 412)) throw error
        plan.result = {
          ...normalize(await api(calendar.accountId, masterPath), calendar),
          id: event.id,
        }
        useWorkspaceUI
          .getState()
          .notify('This series changed in Google. Review the latest version.')
      }
    }
  } else {
    if (!plan.before) {
      const zone = plan.master.start.timeZone || calendar.timeZone || 'UTC'
      const start = plan.master.start.date
        ? new Date(`${plan.master.start.date}T00:00:00Z`)
        : new TZDate(plan.master.start.dateTime, zone)
      const floating = plan.master.start.date
        ? start
        : new Date(
            Date.UTC(
              start.getFullYear(),
              start.getMonth(),
              start.getDate(),
              start.getHours(),
              start.getMinutes(),
              start.getSeconds(),
            ),
          )
      const originalRule = (plan.master.recurrence as string[])
        .find((line) => line.startsWith('RRULE:'))
        ?.slice(6)
      if (!originalRule) throw new Error('This series has no repeat rule.')
      const rules = splitRule(
        originalRule,
        floating,
        boundary,
        plan.master.start.date ? undefined : zone,
      )
      const extra = partitionRecurrence(plan.master.recurrence, boundary, zone)
      const before = plan.master.start.date
        ? rules.before.replace(
            /UNTIL=\d{8}T\d{6}Z/,
            `UNTIL=${shiftDay(edit.occurrence.slice(0, 10), -1).replaceAll('-', '')}`,
          )
        : rules.before
      plan.before = [`RRULE:${before}`, ...extra.before]
      if (!event.deletedAt) {
        const recurrence = edit.changedFields.includes('recurrence')
          ? event.recurrence
          : rules.after
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${event.id}:${event.updatedAt}`),
        )
        const splitId =
          'split' +
          Array.from(new Uint8Array(digest), (value) =>
            value.toString(16).padStart(2, '0'),
          ).join('')
        plan.body = {
          ...payload(event),
          id: splitId,
          recurrence: recurrence ? [`RRULE:${recurrence}`, ...extra.after] : [],
        }
      }
      await persistPlan()
    }
    if (plan.body && !plan.created) {
      try {
        plan.created = await api(calendar.accountId, base, {
          method: 'POST',
          body: JSON.stringify(plan.body),
        })
      } catch (error) {
        if (!(error instanceof GoogleError && error.status === 409)) throw error
        plan.created = await api(calendar.accountId, `${base}/${plan.body.id}`)
      }
      await persistPlan()
    }
    try {
      await api(calendar.accountId, masterPath, {
        method: 'PATCH',
        headers: { 'If-Match': plan.master.etag },
        body: JSON.stringify({ recurrence: plan.before }),
      })
    } catch (error) {
      if (!(error instanceof GoogleError && error.status === 412)) throw error
      const latest = await api(calendar.accountId, masterPath)
      if (JSON.stringify(latest.recurrence) !== JSON.stringify(plan.before)) {
        if (plan.created)
          await api(calendar.accountId, `${base}/${plan.created.id}`, {
            method: 'DELETE',
            headers: { 'If-Match': plan.created.etag },
          })
        const current = await api(
          calendar.accountId,
          `${base}/${encodeURIComponent(event.providerEventId!)}`,
        )
        useWorkspaceUI
          .getState()
          .notify(
            'This series changed in Google. Your split was cancelled; review the latest event.',
          )
        plan.result = { ...normalize(current, calendar), id: event.id }
      }
    }
    plan.result ??= plan.created
      ? { ...normalize(plan.created, calendar), id: event.id }
      : { ...event, recurrenceEdit: undefined }
  }
  await persistPlan()
  await invalidateGoogleCalendar(calendar)
  return plan.result
}
export async function connectGoogle() {
  const data = await googleService('connect')
  const url = new URL(data.url)
  if (
    url.origin !== 'https://accounts.google.com' ||
    url.pathname !== '/o/oauth2/v2/auth'
  )
    throw new Error(
      'The calendar service returned an invalid Google sign-in link.',
    )
  return url.href
}
export async function pushGoogleEvent(event: CalendarEvent) {
  if (!event.calendarId) return event
  const calendar = useCalendars
    .getState()
    .calendars.find((c) => c.id === event.calendarId)
  if (!calendar)
    throw new Error('Load your Google calendars before saving this event')
  if (!['owner', 'writer'].includes(calendar.accessRole))
    throw new Error('This calendar is read-only')
  if (
    event.recurringEventId &&
    event.recurrenceEdit &&
    event.recurrenceEdit.scope !== 'this'
  )
    return changeGoogleSeries(calendar, event)
  if (event.deletedAt) {
    if (event.providerEventId) {
      try {
        await googleProvider.delete(calendar, event)
      } catch (error) {
        if (!(error instanceof GoogleError && error.status === 412)) throw error
        useWorkspaceUI
          .getState()
          .notify(
            'This event changed in Google. Deletion was cancelled; review the latest version.',
          )
        return {
          ...normalize(
            await api(
              calendar.accountId,
              `/calendars/${encodeURIComponent(calendar.providerId)}/events/${encodeURIComponent(event.providerEventId)}`,
            ),
            calendar,
          ),
          id: event.id,
        }
      }
    }
    return event
  }
  return event.providerEventId
    ? googleProvider.update(calendar, event)
    : googleProvider.create(calendar, event)
}
export async function syncGoogle(force = false) {
  const session = useAccount.getState().session
  if (
    !session ||
    !supabase ||
    useCalendars.getState().busy ||
    !navigator.onLine
  )
    return
  const scope = session.user.id
  useCalendars.setState({ busy: true, error: '' })
  try {
    const { accounts } = await googleService('accounts')
    const { data: cached, error } = await supabase
      .from('kw_calendars')
      .select('id,data')
      .eq('user_id', scope)
    if (error) throw error
    const calendars: UserCalendar[] = [],
      failures: string[] = [],
      unavailable = new Set<string>()
    for (const account of accounts as CalendarAccount[]) {
      const key = `account:${account.id}`,
        retry = retries.get(key)
      if (!force && retry && retry.until > Date.now()) {
        failures.push(retry.message)
        unavailable.add(account.id)
        calendars.push(
          ...(cached || [])
            .filter((r) => r.data.accountId === account.id)
            .map((r) => ({ ...r.data, id: r.id })),
        )
        continue
      }
      try {
        for (const remote of await googleProvider.listCalendars(account)) {
          const previous = cached?.find(
            (r) =>
              r.data.accountId === account.id &&
              r.data.providerId === remote.providerId,
          )
          const calendar = {
            ...remote,
            ...previous?.data,
            name: remote.name,
            accessRole: remote.accessRole,
            id: previous?.id ?? crypto.randomUUID(),
          }
          calendars.push(calendar)
        }
        retries.delete(key)
      } catch (error) {
        failures.push(`${account.email}: ${backoff(key, error)}`)
        unavailable.add(account.id)
        calendars.push(
          ...(cached || [])
            .filter((r) => r.data.accountId === account.id)
            .map((r) => ({ ...r.data, id: r.id })),
        )
      }
    }
    if (useAccount.getState().session?.user.id !== scope) return
    useCalendars.setState({ accounts, calendars })
    for (const calendar of calendars) {
      if (unavailable.has(calendar.accountId)) continue
      const retry = retries.get(calendar.id)
      if (!force && retry && retry.until > Date.now()) {
        failures.push(retry.message)
        continue
      }
      try {
        const result = await googleProvider.sync(calendar)
        const pending = new Set(
          (await db.outbox.where('scope').equals(scope).toArray())
            .filter((p) => p.collection === 'events')
            .map((p) => p.id),
        )
        let existing = useWorkspace.getState().events
        if (result.reset) {
          const received = new Set(result.events.map((e) => e.providerEventId))
          existing = existing.map((e) =>
            e.calendarId === calendar.id &&
            !pending.has(e.id) &&
            !received.has(e.providerEventId)
              ? { ...e, deletedAt: new Date().toISOString() }
              : e,
          )
          const removed = existing.filter(
            (e) =>
              e.calendarId === calendar.id && e.deletedAt && !pending.has(e.id),
          )
          if (removed.length) {
            const { error } = await supabase.from('kw_events').upsert(
              removed.map((e) => ({
                id: e.id,
                user_id: scope,
                data: e,
                updated_at: new Date().toISOString(),
              })),
            )
            if (error) throw error
          }
        }
        const mapped = new Map(existing.map((e) => [e.id, e]))
        for (const event of result.events) {
          const old = existing.find(
            (e) =>
              e.calendarId === calendar.id &&
              e.providerEventId === event.providerEventId,
          )
          const id = old?.id ?? event.id
          if (!pending.has(id)) mapped.set(id, { ...event, id })
        }
        if (useAccount.getState().session?.user.id !== scope) return
        applyRemotePatch({ events: [...mapped.values()] })
        calendar.syncToken = result.token
        calendar.eventFormatVersion = 2
        const changed = result.events
          .map((e) => {
            const old = existing.find(
              (r) =>
                r.calendarId === calendar.id &&
                r.providerEventId === e.providerEventId,
            )
            return { ...e, id: old?.id ?? e.id }
          })
          .filter((e) => !pending.has(e.id))
        if (changed.length) {
          const { error } = await supabase.from('kw_events').upsert(
            changed.map((e) => ({
              id: e.id,
              user_id: scope,
              data: e,
              updated_at: new Date().toISOString(),
            })),
          )
          if (error) throw error
        }
        const { error: calendarError } = await supabase
          .from('kw_calendars')
          .upsert(
            {
              id: calendar.id,
              user_id: scope,
              account_id: calendar.accountId,
              provider_id: calendar.providerId,
              data: calendar,
            },
            { onConflict: 'user_id,account_id,provider_id' },
          )
        if (calendarError) throw calendarError
        retries.delete(calendar.id)
      } catch (error) {
        failures.push(`${calendar.name}: ${backoff(calendar.id, error)}`)
      }
    }
    if (useAccount.getState().session?.user.id !== scope) return
    useCalendars.setState({ error: [...new Set(failures)].join(' · ') })
    await db.versions.put({
      key: `google-calendars:${scope}`,
      value: JSON.stringify(calendars),
    })
  } catch (error) {
    useCalendars.setState({
      error: error instanceof Error ? error.message : 'Google sync failed',
    })
  } finally {
    useCalendars.setState({ busy: false })
  }
}
export async function disconnectGoogle(accountId: string) {
  await googleService('disconnect', { accountId })
  tokenCache.delete(accountId)
  const ids = new Set(
    useCalendars
      .getState()
      .calendars.filter((c) => c.accountId === accountId)
      .map((c) => c.id),
  )
  const state = useWorkspace.getState()
  applyRemotePatch({
    events: state.events.filter((e) => !e.calendarId || !ids.has(e.calendarId)),
  })
  await db.outbox
    .where('scope')
    .equals(state.scope)
    .filter(
      (p) => p.collection === 'events' && ids.has(String(p.data.calendarId)),
    )
    .delete()
  await supabase
    ?.from('kw_events')
    .delete()
    .eq('user_id', state.scope)
    .in('data->>calendarId', [...ids])
  useCalendars.setState({
    accounts: useCalendars
      .getState()
      .accounts.filter((a) => a.id !== accountId),
    calendars: useCalendars
      .getState()
      .calendars.filter((c) => c.accountId !== accountId),
  })
  await db.snapshots.put({
    scope: state.scope,
    content: {
      pages: state.pages,
      projects: state.projects,
      tasks: state.tasks,
      events: useWorkspace.getState().events,
      scratchpad: state.scratchpad,
      taskViews: state.taskViews,
    },
  })
}
