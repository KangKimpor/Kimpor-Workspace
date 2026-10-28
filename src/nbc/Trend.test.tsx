import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Trend from './Trend'

const summary = { projectId: 'nbc-bp03', previous: .1, contributions: {}, updatedAt: '' }

test('actual points come only from confirmed summaries in week order, drawn against the plan, with a table view', () => {
  render(<Trend today="2026-10-28" summaries={[
    { ...summary, id: 'later', weekStart: '2026-10-26', overall: .4 },
    { ...summary, id: 'earlier', weekStart: '2026-10-19', overall: .2 },
  ]}/>)
  const chart = screen.getByRole('img')
  expect(chart.querySelector('[data-series=plan]')?.getAttribute('points')?.split(' ')).toHaveLength(15)
  expect(chart.querySelector('[data-series=actual]')?.getAttribute('points')?.split(' ')).toHaveLength(2)
  expect(chart.querySelectorAll('circle')).toHaveLength(2)
  expect(chart.textContent).toContain('Deadline 20 Jun 2026')
  fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
  expect(screen.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['19 Oct – 25 Oct100.00%20.00%▲ +10.00%', '26 Oct – 1 Nov100.00%40.00%▲ +30.00%'])
})

test('empty history still shows the plan and says there are no confirmed weeks', () => {
  render(<Trend summaries={[]}/>)
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('No confirmed reporting weeks')
  expect(document.querySelectorAll('.nbc-trend circle')).toHaveLength(0)
  expect(document.querySelector('[data-series=plan]')).toBeTruthy()
})
