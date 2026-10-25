import { useWorkspace } from './index'
import { db } from './persistence'
import { supabase } from '@/lib/supabase'

const objects = new Map<string, string>()
export async function uploadWorkspaceFile(file: File) {
  if (
    file.size > 10 * 1024 * 1024 ||
    ![
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ].includes(file.type)
  )
    throw new Error(
      'Use a PNG, JPEG, WebP, GIF, PDF, or text file up to 10 MB.',
    )
  const id = crypto.randomUUID()
  const scope = useWorkspace.getState().scope
  if (scope !== 'guest' && navigator.onLine && supabase) {
    const path = `${scope}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error } = await supabase.storage.from('kw-files').upload(path, file)
    if (error) throw error
    return `storage:${path}`
  }
  await db.files.put({ id, blob: file, name: file.name })
  return `local-file:${id}`
}
export async function resolveFile(url: string) {
  if (url.startsWith('storage:') && supabase) {
    const { data, error } = await supabase.storage
      .from('kw-files')
      .createSignedUrl(url.slice(8), 3600)
    if (error) throw error
    return data.signedUrl
  }
  if (url.startsWith('local-file:')) {
    if (objects.has(url)) return objects.get(url)!
    const file = await db.files.get(url.slice(11))
    if (file) {
      const object = URL.createObjectURL(file.blob)
      objects.set(url, object)
      return object
    }
    return ''
  }
  return /^(https?:|blob:)/i.test(url) ? url : ''
}
export async function syncWorkspaceFiles(
  record: Record<string, unknown>,
  scope: string,
) {
  let serialized = JSON.stringify(record)
  const ids = new Set(
    [...serialized.matchAll(/"local-file:([a-f0-9-]{36})"/g)].map(
      (match) => match[1]!,
    ),
  )
  for (const id of ids) {
    const file = await db.files.get(id)
    if (!file || !supabase)
      throw new Error(
        'An offline attachment is missing on this device. Reattach it before syncing.',
      )
    const path = `${scope}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error } = await supabase.storage
      .from('kw-files')
      .upload(path, file.blob, { upsert: true })
    if (error) throw error
    serialized = serialized.replaceAll(
      `"local-file:${id}"`,
      JSON.stringify(`storage:${path}`),
    )
  }
  return JSON.parse(serialized) as Record<string, unknown>
}
