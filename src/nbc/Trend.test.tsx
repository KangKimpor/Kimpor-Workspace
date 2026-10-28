import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Trend from './Trend'

test('trend charts only confirmed summary values in week order and retains the table view', () => {
  const summary = { projectId: 'nbc-bp03', previous: .1, contributions: {}, updatedAt: '' }
  render(<Trend summaries={[
    { ...summary, id: 'later', weekStart: '2026-10-26', overall: .4 },
    { ...summary, id: 'earlier', weekStart: '2026-10-19', overall: .2 },
  ]}/>)
  const chart = screen.getByRole('img')
  expect(chart.querySelector('polyline')?.getAttribute('points')).toBe('0,160.8 880,125.6')
  expect(chart.querySelectorAll('circle')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
  expect(screen.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['19 Oct – 25 Oct20.00%▲ +10.00%', '26 Oct – 1 Nov40.00%▲ +30.00%'])
})

test('empty history states that there are no confirmed weeks', () => {
  render(<Trend summaries={[]}/>)
  expect(screen.getByRole('img').getAttribute('aria-label')).toBe('No confirmed reporting weeks')
  expect(document.querySelectorAll('.nbc-trend circle')).toHaveLength(0)
})
