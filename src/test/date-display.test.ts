import { expect, it, vi } from 'vitest'
import { formatDate } from '@/components/WorkspaceUI'

it('formats local English dates without initializing Intl on the home screen', () => {
  const formatter = vi.spyOn(Intl, 'DateTimeFormat')
  try {
    expect(formatDate('')).toBe('No date')
    expect(formatDate('2026-01-01')).toBe('Jan 1')
    expect(formatDate('2028-02-29')).toBe('Feb 29')
    expect(formatDate('2026-12-31')).toBe('Dec 31')
    expect(() => formatDate('invalid')).toThrow(RangeError)
    expect(formatter).not.toHaveBeenCalled()
  } finally {
    formatter.mockRestore()
  }
})
