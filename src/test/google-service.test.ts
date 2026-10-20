import { afterEach, expect, test, vi } from 'vitest'
vi.mock('@/data/sync', () => ({useAccount: { getState: () => ({session:null}) }}))
vi.mock('@/data/persistence', () => ({db:{}}))
import { googleService, connectGoogle, normalize, payload, googleProvider } from '@/calendar/google'
afterEach(() => vi.unstubAllGlobals())
test('calendar requests have a timeout and report interrupted requests', async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.signal?.aborted).toBe(false)
    throw new DOMException('Timed out', 'TimeoutError')
  })
  vi.stubGlobal('fetch', fetcher)
  await expect(googleService('connect')).rejects.toThrow('took too long')
})
test('only the expected Google authorization URL can be offered', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({url:'https://wrong.example/auth'}))))
  await expect(connectGoogle()).rejects.toThrow('invalid Google sign-in link')
})

const calendar = { id: 'calendar', accountId: 'account', providerId: 'remote', name: 'Work', color: 'blue' as const, visible: true, accessRole: 'owner', timeZone: 'America/New_York' }
const rawEvent = {
  id: 'event', summary: 'Review',
  start: {dateTime:'2026-11-01T01:30:00-04:00', timeZone:'America/New_York'},
  end: {dateTime:'2026-11-01T02:30:00-05:00', timeZone:'America/New_York'},
}
test('Google event clocks round-trip without shifting the instant across zones or DST', () => {
  const event = normalize(rawEvent, calendar)
  expect(event.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(event.sourceTimeZone).toBe('America/New_York')
  const saved = payload(event)
  expect(saved.start.timeZone).toBe('America/New_York')
  expect(new Date(saved.start.dateTime!).toISOString()).toBe(new Date(rawEvent.start.dateTime).toISOString())
  expect(new Date(saved.end.dateTime!).toISOString()).toBe(new Date(rawEvent.end.dateTime).toISOString())
})
test('title edits preserve RSVP details and both email and popup reminders', () => {
  const reminders = {useDefault:false, overrides:[{method:'email',minutes:60},{method:'popup',minutes:10}]}
  const event = normalize({...rawEvent, reminders, attendees:[{email:'guest@example.invalid',responseStatus:'accepted',optional:true}]}, calendar)
  const saved = payload({...event, title:'Updated review'})
  expect(saved.reminders).toEqual(reminders)
  expect(saved.attendees).toEqual([{email:'guest@example.invalid',responseStatus:'accepted',optional:true}])
  expect(payload({...event, reminders:[],googleReminders:undefined}).reminders).toEqual({useDefault:false,overrides:[]})
})
test('unknown reminder settings are omitted so PATCH preserves them, while calendar defaults round-trip', () => {
  expect(JSON.parse(JSON.stringify(payload(normalize(rawEvent, calendar))))).not.toHaveProperty('reminders')
  expect(payload(normalize({...rawEvent, reminders:{useDefault:true}},calendar)).reminders).toEqual({useDefault:true})
})
test('all-day Google dates preserve their exclusive end on save', () => {
  const event = normalize({...rawEvent,start:{date:'2026-10-20'},end:{date:'2026-10-23'}},calendar)
  expect(event.endDate).toBe('2026-10-22')
  expect(payload(event)).toMatchObject({start:{date:'2026-10-20'},end:{date:'2026-10-23'}})
})
test('cached calendars are refreshed once when the event representation changes', async () => {
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url.startsWith('/api/') ? {access_token:'short-lived',expires_in:3600} : {items:[],nextSyncToken:'next'})))
  vi.stubGlobal('fetch',fetcher)
  const result = await googleProvider.sync({...calendar, syncToken:'old-token'})
  expect(result.reset).toBe(true)
  expect(fetcher.mock.calls.some(([url]) => url.includes('syncToken=old-token'))).toBe(false)
  const incremental = await googleProvider.sync({...calendar,eventFormatVersion:2,syncToken:'current-token'})
  expect(incremental.reset).toBe(false)
  expect(fetcher.mock.calls.some(([url]) => url.includes('syncToken=current-token'))).toBe(true)
})

test('editing a repeated DST clock retains its second occurrence offset', () => {
  const event = {...normalize(rawEvent,calendar), date:'2026-11-01',endDate:'2026-11-01',start:'01:30',end:'01:45',timeZone:'America/New_York',startInstant:'2026-11-01T01:30:00-05:00',endInstant:'2026-11-01T01:45:00-05:00'}
  expect(new Date(payload(event).start.dateTime!).toISOString()).toBe('2026-11-01T06:30:00.000Z')
  expect(new Date(payload({...event,start:'02:30'}).start.dateTime!).toISOString()).toBe('2026-11-01T07:30:00.000Z')
})

test('Meet links are restricted to Google Meet and attendee responses remain visible data', () => {
  const event = normalize({...rawEvent,hangoutLink:'https://meet.google.com/abc-defg-hij',attendees:[{email:'guest@example.invalid',responseStatus:'tentative'}]},calendar)
  expect(event.meetLink).toBe('https://meet.google.com/abc-defg-hij')
  expect(event.googleAttendees?.[0]?.responseStatus).toBe('tentative')
  expect(normalize({...rawEvent,hangoutLink:'javascript:alert(1)'},calendar).meetLink).toBeUndefined()
})

test('Google color IDs preserve existing colors, explicit changes and calendar defaults', () => {
  const event = normalize({...rawEvent,colorId:'1'},calendar)
  expect(event.googleColorId).toBe('1')
  expect(payload({...event,title:'Only rename'}).colorId).toBe('1')
  expect(payload({...event,googleColorId:'11'}).colorId).toBe('11')
  expect(payload({...event,googleColorId:null}).colorId).toBeNull()
  expect(normalize({...rawEvent,colorId:'11'},calendar).color).toBe('red')
})
