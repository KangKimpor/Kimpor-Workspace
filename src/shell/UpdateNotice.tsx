import { useState } from 'react'
import { useInstall } from '@/lib/install'

export function UpdateNotice() {
  const update = useInstall((state) => state.update)
  const [error, setError] = useState(false)
  if (!update) return null
  return (
    <div className="update-notice" role="status">
      <span>{error ? 'Update failed. Try again.' : 'New version available'}</span>
      <button className="btn-accent" onClick={() => void update().catch(() => setError(true))}>Reload</button>
      <button className="btn-secondary" onClick={() => useInstall.setState({ update: null })}>Later</button>
    </div>
  )
}
