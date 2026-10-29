import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useWorkspace } from '@/data'
import { fixtureActivities } from '../test-fixture'
import ExportWorkbook from './ExportWorkbook'
import { loadReportTemplate } from './template'

vi.mock('./template', () => ({ loadReportTemplate: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); useWorkspace.setState({ scope: 'signed-in-account' }) })
const show = () => render(<ExportWorkbook projectId="nbc-bp03" activities={fixtureActivities()} submissions={[]} onClose={() => {}}/>)

test('signed-in export loads the shared format automatically without a file picker', async () => {
  vi.mocked(loadReportTemplate).mockResolvedValue({ name: 'BP03.xlsx', data: new ArrayBuffer(0) })
  show()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeEnabled())
  expect(loadReportTemplate).toHaveBeenCalledWith('nbc-bp03')
  expect(screen.queryByLabelText('Weekly report template')).toBeNull()
})

test('unavailable shared format blocks download and explains how to retry', async () => {
  vi.mocked(loadReportTemplate).mockRejectedValue(new Error('Offline'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Close and reopen')
  expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeDisabled()
})
