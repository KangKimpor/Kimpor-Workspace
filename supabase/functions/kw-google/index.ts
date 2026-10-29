import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { z } from 'npm:zod@4.6.7'
import { seal, unseal } from './crypto.ts'
import { tokenFailure } from './token-error.ts'

const env = (name: string) => Deno.env.get(name) || ''
const appUrl = () => env('KW_APP_URL') || 'https://singbuildworkspace.vercel.app'
const callback = () => `${env('SUPABASE_URL')}/functions/v1/kw-google/callback`
const masterKey = () =>
  env('KW_TOKEN_ENCRYPTION_KEY') || env('CREDENTIAL_ENCRYPTION_KEY')
const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
const b64url = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
const bodySchema = z
  .object({ accountId: z.string().uuid().optional() })
  .passthrough()
async function googleToken(params: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
    }),
    signal: AbortSignal.timeout(15000),
  })
  const value = await response.json()
  if (!response.ok || typeof value.access_token !== 'string')
    throw new Error(tokenFailure(value.error))
  return value
}
async function access(accountId: string, userId: string) {
  const db = admin()
  const { data: record, error } = await db
    .from('kw_calendar_tokens')
    .select('encrypted_token')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .single()
  if (error || !record) throw new Error('Account not found')
  const refresh = await unseal(record.encrypted_token, userId, masterKey())
  try {
    return await googleToken({
      grant_type: 'refresh_token',
      refresh_token: refresh,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Reconnect this Google account'
    )
      await db
        .from('kw_calendar_accounts')
        .update({ status: 'Needs sign-in' })
        .eq('id', accountId)
        .eq('user_id', userId)
    throw error
  }
}

Deno.serve(async (request) => {
  const url = new URL(request.url),
    action = url.pathname.split('/').pop() || ''
  try {
    if (action === 'info')
      return json({
        configured: !!(
          env('GOOGLE_CLIENT_ID') &&
          env('GOOGLE_CLIENT_SECRET') &&
          masterKey()
        ),
        callback: callback(),
      })
    if (action === 'callback') {
      if (request.method !== 'GET') return json({ error: 'Use GET' }, 405)
      if (url.searchParams.has('error'))
        return Response.redirect(
          `${appUrl()}/settings/accounts?calendar_error=denied`,
          303,
        )
      const state = z.string().uuid().parse(url.searchParams.get('state')),
        code = z.string().min(1).max(4096).parse(url.searchParams.get('code'))
      const db = admin()
      const { data: states, error } = await db
        .from('kw_oauth_states')
        .delete()
        .eq('id', state)
        .gt('expires_at', new Date().toISOString())
        .select('user_id,verifier')
      if (error || !states?.length)
        return json(
          {
            error:
              'Connection request expired or was already used. Start again in the app.',
          },
          400,
        )
      const entry = states[0],
        verifier = await unseal(entry.verifier, entry.user_id, masterKey())
      const tokens = await googleToken({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: callback(),
      })
      if (typeof tokens.refresh_token !== 'string')
        throw new Error('No offline token returned. Reconnect with consent.')
      const profileResponse = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(15000),
        },
      )
      const profile = z
        .object({
          sub: z.string(),
          email: z.string().email(),
          name: z.string().optional(),
          picture: z.string().optional(),
        })
        .parse(await profileResponse.json())
      const { data: account, error: accountError } = await db
        .from('kw_calendar_accounts')
        .upsert(
          {
            user_id: entry.user_id,
            provider_account_id: profile.sub,
            email: profile.email,
            name: profile.name || profile.email,
            picture: profile.picture,
            status: 'OK',
          },
          { onConflict: 'user_id,provider_account_id' },
        )
        .select('id')
        .single()
      if (accountError) throw accountError
      const { error: tokenError } = await db
        .from('kw_calendar_tokens')
        .upsert({
          account_id: account.id,
          user_id: entry.user_id,
          encrypted_token: await seal(
            tokens.refresh_token,
            entry.user_id,
            masterKey(),
          ),
        })
      if (tokenError) throw tokenError
      return Response.redirect(
        `${appUrl()}/settings/accounts?connected=google`,
        303,
      )
    }
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)
    const authorization = request.headers.get('authorization') || ''
    if (!authorization.startsWith('Bearer '))
      return json({ error: 'Sign in first' }, 401)
    const {
      data: { user },
      error: authError,
    } = await admin().auth.getUser(authorization.slice(7))
    if (authError || !user)
      return json({ error: 'Your session expired. Sign in again.' }, 401)
    const raw = await request.text()
    if (raw.length > 4096) return json({ error: 'Request too large' }, 413)
    const body = bodySchema.parse(JSON.parse(raw || '{}')),
      db = admin()
    const { data: allowed, error: rateError } = await db.rpc('kw_google_rate', {
      owner_id: user.id,
    })
    if (rateError) throw rateError
    if (!allowed)
      return json({ error: 'Too many requests. Try again in a minute.' }, 429)
    if (action === 'connect') {
      if (
        !env('GOOGLE_CLIENT_ID') ||
        !env('GOOGLE_CLIENT_SECRET') ||
        !masterKey()
      )
        return json(
          { error: 'Google OAuth is not configured on the server.' },
          503,
        )
      const state = crypto.randomUUID(),
        verifier = b64url(crypto.getRandomValues(new Uint8Array(32))),
        challenge = b64url(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(verifier),
            ),
          ),
        )
      const { error } = await db
        .from('kw_oauth_states')
        .insert({
          id: state,
          user_id: user.id,
          verifier: await seal(verifier, user.id, masterKey()),
          expires_at: new Date(Date.now() + 600000).toISOString(),
        })
      if (error) throw error
      const target = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      target.search = new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'),
        redirect_uri: callback(),
        response_type: 'code',
        scope:
          'openid email profile https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent select_account',
        include_granted_scopes: 'true',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString()
      return json({ url: target.href })
    }
    if (action === 'accounts') {
      const { data, error } = await db
        .from('kw_calendar_accounts')
        .select('id,email,name,picture,status')
        .eq('user_id', user.id)
      if (error) throw error
      return json({ accounts: data })
    }
    const accountId = z.string().uuid().parse(body.accountId)
    const { data: account, error: accountError } = await db
      .from('kw_calendar_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()
    if (accountError || !account)
      return json({ error: 'Account not found' }, 404)
    if (action === 'token') {
      const token = await access(accountId, user.id)
      return json({
        access_token: token.access_token,
        expires_in: token.expires_in,
      })
    }
    if (action === 'disconnect') {
      const { data: record } = await db
        .from('kw_calendar_tokens')
        .select('encrypted_token')
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .single()
      if (record) {
        const token = await unseal(record.encrypted_token, user.id, masterKey())
        const response = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok && response.status !== 400)
          throw new Error('Google revocation failed. Try again.')
      }
      const { error } = await db
        .from('kw_calendar_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id)
      if (error) throw error
      return json({ ok: true })
    }
    return json({ error: 'Unknown operation' }, 404)
  } catch (error) {
    return json(
      {
        error:
          error instanceof z.ZodError
            ? 'Invalid request'
            : error instanceof Error &&
                [
                  'Reconnect this Google account',
                  'No offline token returned. Reconnect with consent.',
                  'Google revocation failed. Try again.',
                  'Google token service is temporarily unavailable. Try again later.',
                ].includes(error.message)
              ? error.message
              : 'Calendar service is temporarily unavailable. Your saved data is unchanged.',
      },
      error instanceof Error &&
        error.message.includes('temporarily unavailable')
        ? 503
        : 400,
    )
  }
})
