import { webcrypto } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import { seal, unseal } from '../../supabase/functions/kw-google/crypto'

afterEach(() => vi.unstubAllGlobals())
test('refresh tokens use random IVs and reject another owner or a modified ciphertext', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const key = Buffer.alloc(32, 17).toString('base64')
  const first = await seal('test-refresh-token', 'owner-a', key)
  const second = await seal('test-refresh-token', 'owner-a', key)
  expect(first).not.toBe(second)
  expect(first).not.toContain('test-refresh-token')
  expect(await unseal(first, 'owner-a', key)).toBe('test-refresh-token')
  await expect(unseal(first, 'owner-b', key)).rejects.toThrow()
  const changed = JSON.parse(first)
  changed.data = `${changed.data[0] === 'A' ? 'B' : 'A'}${changed.data.slice(1)}`
  await expect(
    unseal(JSON.stringify(changed), 'owner-a', key),
  ).rejects.toThrow()
  await expect(seal('token', 'owner-a', 'c2hvcnQ=')).rejects.toThrow('256-bit')
})
