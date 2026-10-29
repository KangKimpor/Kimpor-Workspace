import { beforeEach, expect, test, vi } from 'vitest'
import { initializeSupabase } from '@/lib/supabase'
import { loadReportTemplate } from './template'

vi.mock('@/lib/supabase', () => ({ initializeSupabase: vi.fn() }))
const single = vi.fn(), eq = vi.fn(() => ({ single })), select = vi.fn(() => ({ eq })), from = vi.fn(() => ({ select }))
beforeEach(() => { vi.clearAllMocks(); vi.mocked(initializeSupabase).mockResolvedValue({ from } as never) })

test('loads the shared private template without a device upload', async () => {
  single.mockResolvedValue({ data: { name: 'BP03.xlsx', base64: btoa('XLSX') }, error: null })
  const file = await loadReportTemplate('nbc-bp03')
  expect(from).toHaveBeenCalledWith('kw_nbc_templates')
  expect(eq).toHaveBeenCalledWith('project_id', 'nbc-bp03')
  expect(file.name).toBe('BP03.xlsx')
  expect([...new Uint8Array(file.data)]).toEqual([88, 76, 83, 88])
})

test('missing or inaccessible templates fail without silently exporting an old local format', async () => {
  single.mockResolvedValue({ data: null, error: { message: 'Denied' } })
  await expect(loadReportTemplate('nbc-bp03')).rejects.toThrow('Could not load')
  single.mockResolvedValue({ data: { name: 'Bad', base64: 1 }, error: null })
  await expect(loadReportTemplate('nbc-bp03')).rejects.toThrow('invalid')
  vi.mocked(initializeSupabase).mockResolvedValue(null)
  await expect(loadReportTemplate('nbc-bp03')).rejects.toThrow('Sign in')
})
