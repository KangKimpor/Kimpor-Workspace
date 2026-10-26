import { createElement } from 'react'
import { act, render, screen } from '@testing-library/react'
import WeeklyHandlers from './WeeklyHandlers'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { rebaseWrite } from '@/data/sync-merge'
import { confirmHandlerUpdate, finalizeWeek, startWeek, updateActivity } from './actions'
import { confirmationKey, reportingToday, reportingWeek, weeklyHandlerStatus } from './reporting-week'
import { fixtureActivities, fixtureProject } from './test-fixture'

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
  localStorage.clear()
  useWorkspace.setState({ ...structuredClone(emptyContent), projects: [fixtureProject], nbc_activities: fixtureActivities(), scope: 'guest' })
})
afterEach(() => vi.useRealTimers())
const report = () => useWorkspace.getState().nbc_reports![0]!
const status = (handler = 'Tola', date = '2026-10-31') => weeklyHandlerStatus(useWorkspace.getState().nbc_reports!, date, useWorkspace.getState().nbc_activities!).find((row) => row.handler === handler)!

test('Saturday noon is 05:00 UTC; week rollover, year boundaries and local dates stay correct', () => {
  expect(reportingWeek('2026-10-26')).toEqual({ ending: '2026-10-31', deadline: Date.parse('2026-10-31T05:00:00Z') })
  expect(reportingWeek('2026-10-31').ending).toBe('2026-10-31')
  expect(reportingWeek('2026-11-01').ending).toBe('2026-11-07')
  expect(reportingWeek('2026-12-31').ending).toBe('2027-01-02')
  expect(reportingToday(new Date('2026-10-30T18:00:00Z'))).toBe('2026-10-31')
  expect(() => reportingWeek('2026-02-30')).toThrow('valid reporting date')
  expect(status().status).toBe('Not yet updated')
  vi.setSystemTime(new Date('2026-10-31T04:59:59Z')); expect(status().status).toBe('Not yet updated')
  vi.setSystemTime(new Date('2026-10-31T05:00:00Z')); expect(status().status).toBe('Overdue')
})

test('handler confirmations include no-change weeks, persist, and reset for the next week', () => {
  expect(() => startWeek(fixtureProject.id, '2026-10-31', null, '', 'unknown')).toThrow('handler')
  startWeek(fixtureProject.id, '2026-10-31', null, '', 'Tola')
  expect(report().startedBy).toBe('Tola')
  expect(() => confirmHandlerUpdate(report().id, '')).toThrow('handler')
  confirmHandlerUpdate(report().id, 'Tola')
  expect(status()).toMatchObject({ status: 'Updated', complete: true, confirmation: { changedCount: 0, assignedCount: 1, editor: 'guest' } })
  expect(status('Sitha').status).toBe('Not yet updated')
  expect(status('Tola', '2026-11-07').complete).toBe(false)
  expect(JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_reports[0].handlerUpdateTola.changedCount).toBe(0)
  for(const handler of ['Sitha','Lychhinh','Chhorvaon','Srun','Kheng'])confirmHandlerUpdate(report().id,handler)
  expect(weeklyHandlerStatus([report()],'2026-10-31',useWorkspace.getState().nbc_activities!).filter(row=>row.complete)).toHaveLength(6)
})

test('editing after confirmation needs review; resubmitting at the cutoff is recorded as late', () => {
  startWeek(fixtureProject.id, '2026-10-31', null, '', 'Tola'); confirmHandlerUpdate(report().id, 'Tola')
  vi.setSystemTime(new Date('2026-10-27T03:00:00Z')); updateActivity('nbc:1.6.1.2', { progress: .5 })
  expect(status()).toMatchObject({ status: 'Needs review', complete: false })
  vi.setSystemTime(new Date('2026-10-31T05:00:00Z')); confirmHandlerUpdate(report().id, 'Tola')
  expect(status()).toMatchObject({ status: 'Updated late', complete: true, confirmation: { changedCount: 1 } })
  finalizeWeek(report().id)
  expect(() => confirmHandlerUpdate(report().id, 'Tola')).toThrow('open update')
})

test('independent handlers merge without losing either confirmation and unsynced changes cannot be confirmed', () => {
  startWeek(fixtureProject.id, '2026-10-31', null, '', 'Tola')
  const original = { ...report() }, confirmation = { at: new Date().toISOString(), editor: 'guest', assignedCount: 1, changedCount: 0 }
  const result = rebaseWrite(original, { ...original, [confirmationKey('Tola')]: confirmation }, { ...original, [confirmationKey('Sitha')]: confirmation })
  expect(result.conflicts).toBe(false)
  expect(result.data).toMatchObject({ handlerUpdateTola: confirmation, handlerUpdateSitha: confirmation })
  useWorkspace.setState({ scope: 'signed-in-user', sync: { kind: 'saving' } })
  expect(() => confirmHandlerUpdate(report().id, 'Tola')).toThrow('Wait for activity changes')
})

test('an open checklist becomes overdue at noon and follows the new week without a reload', () => {
  vi.setSystemTime(new Date('2026-10-31T04:59:59Z'))
  render(createElement(WeeklyHandlers,{reports:[],activities:fixtureActivities()}))
  expect(screen.getAllByText('Not yet updated')).toHaveLength(6)
  act(()=>vi.advanceTimersByTime(1000))
  expect(screen.getAllByText('Overdue')).toHaveLength(6)
  vi.setSystemTime(new Date('2026-10-31T17:00:00Z'))
  act(()=>vi.advanceTimersByTime(60000))
  expect(screen.getByText(/Due Saturday 7 Nov 2026/)).toBeInTheDocument()
  expect(screen.getAllByText('Not yet updated')).toHaveLength(6)
})
