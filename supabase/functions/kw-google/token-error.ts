export function tokenFailure(code: unknown) {
  return code === 'invalid_grant'
    ? 'Reconnect this Google account'
    : 'Google token service is temporarily unavailable. Try again later.'
}
