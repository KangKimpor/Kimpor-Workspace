import type { SupabaseClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
export let supabase: SupabaseClient | null = null
let initializing: Promise<SupabaseClient | null> | undefined
export function hasStoredSession() {
  try {
    return (
      !!url &&
      !!localStorage.getItem(
        `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
      )
    )
  } catch {
    return false
  }
}
export function initializeSupabase() {
  if (!url || !key) return Promise.resolve(null)
  return (initializing ??= import('@supabase/supabase-js')
    .then(({ createClient }) => {
      supabase = createClient(url, key, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          autoRefreshToken: true,
          persistSession: true,
        },
      })
      return supabase
    })
    .catch((error) => {
      initializing = undefined
      throw error
    }))
}
