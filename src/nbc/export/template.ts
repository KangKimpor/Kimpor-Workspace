import { initializeSupabase } from '@/lib/supabase'
import { MAX_TEMPLATE_BYTES } from './workbook'

export async function loadReportTemplate(projectId: string) {
  const client = await initializeSupabase()
  if (!client) throw new Error('Sign in to load the BP03 report format.')
  const { data, error } = await client.from('kw_nbc_templates').select('name,base64').eq('project_id', projectId).single()
  if (error || !data) throw new Error('Could not load the BP03 report format. Please try again.')
  if (typeof data.name !== 'string' || typeof data.base64 !== 'string' || data.base64.length > Math.ceil(MAX_TEMPLATE_BYTES / 3) * 4) throw new Error('The saved BP03 report format is invalid.')
  const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))
  return { name: data.name, data: bytes.buffer }
}
