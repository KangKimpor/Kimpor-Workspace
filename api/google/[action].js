/**
 * @param {import('node:http').IncomingMessage & {query: Record<string,string>, body?: unknown}} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req,res) {
  const action = req.query.action
  if (
    !['info', 'connect', 'token', 'disconnect', 'accounts'].includes(
      action || '',
    )
  ) {
    res.writeHead(404).end()
    return
  }
  if (req.method !== (action === 'info' ? 'GET' : 'POST')) {
    res.writeHead(405, { Allow: action === 'info' ? 'GET' : 'POST' }).end()
    return
  }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  const origin = req.headers.origin
  const host = req.headers.host
  let allowedOrigin = true
  try { allowedOrigin = !origin || new URL(origin).host === host } catch { allowedOrigin = false }
  if (!allowedOrigin) {
    res.writeHead(403).end(JSON.stringify({ error: 'Origin not allowed' }))
    return
  }
  const authorization = req.headers.authorization
  if (action !== 'info' && !authorization?.startsWith('Bearer ')) {
    res.writeHead(401).end(JSON.stringify({ error: 'Sign in first' }))
    return
  }
  const base = process.env.VITE_SUPABASE_URL
  if (!base) {
    res
      .writeHead(503)
      .end(JSON.stringify({ error: 'Cloud service is not configured' }))
    return
  }
  const body =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  if (body.length > 4096) {
    res.writeHead(413).end()
    return
  }
  try {
    const response = await fetch(`${base}/functions/v1/kw-google/${action}`, {
      method: action === 'info' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      ...(action === 'info' ? {} : { body }),
      signal: AbortSignal.timeout(25000),
    })
    res.writeHead(response.status).end(await response.text())
  } catch {
    res
      .writeHead(503)
      .end(
        JSON.stringify({
          error: 'Calendar service is temporarily unavailable',
        }),
      )
  }
}
