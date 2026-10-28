import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import Overview from './Overview'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T03:00:00Z')) })
afterEach(() => vi.useRealTimers())
const show = () => render(<MemoryRouter><Overview project={fixtureProject} activities={fixtureActivities()} submissions={[]} summaries={[]} baseline={new Map()}/></MemoryRouter>)

test('headline numbers compare actual progress with the contract plan and deadline', () => {
  show()
  const kpis = within(screen.getByRole('region', { name: 'Project snapshot' }))
  expect(kpis.getByText('Overall progress')).toBeTruthy()
  expect(kpis.getByText('20 Jun 2026')).toBeTruthy()
  expect(kpis.getByText('130 days overdue')).toBeTruthy()
  expect(kpis.getByText(/behind/)).toBeTruthy()
  expect(kpis.getByText('Plan: 100.0% by now')).toBeTruthy()
  expect(kpis.getByText('0 of 6 handlers updated this week')).toBeTruthy()
  expect(kpis.getByText('3 days left')).toBeTruthy()
})

test('forecast waits for a confirmed week, and attention lists handlers who have not updated', () => {
  show()
  expect(screen.getByText(/forecast appears after the first confirmed week/i)).toBeTruthy()
  const attention = within(screen.getByRole('region', { name: 'Needs attention' }))
  expect(attention.getByText('Sitha, Tola have not updated')).toBeTruthy()
  expect(attention.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/projects-progress/nbc-bp03/update')
})

test('the breakdown can switch to a floor by trade heatmap whose cells open filtered activities', () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
  const cell = screen.getByRole('link', { name: /^GF, Test trade/ })
  expect(cell.getAttribute('href')).toContain('location=GF')
  expect(cell.getAttribute('href')).toContain('trade=Test+trade')
})

test('the weekly digest opens as a dialog with a copyable summary and closes on Escape', () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Weekly digest' }))
  const dialog = screen.getByRole('dialog', { name: 'Weekly digest' })
  expect(within(dialog).getByText(/Completion deadline 20 Jun 2026: 130 days overdue/)).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: 'Copy summary' })).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})
