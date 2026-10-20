import { useState } from 'react'
import { useInstall } from '@/lib/install'

export function UpdateNotice() {
  const update = useInstall((state) => state.update)
  const [error, setError] = useState(false)
  const [updating, setUpdating] = useState(false)
  if (!update) return null
  return (
    <div className="update-notice" role="status">
      <span>{error ? 'Update failed. Try again.' : 'New version available'}</span>
      <button className="btn-accent" disabled={updating} onClick={() => {
        setUpdating(true)
        setError(false)
        void update().catch(() => { setError(true); setUpdating(false) })
      }}>{updating ? 'Reloading…' : 'Reload'}</button>
      <button className="btn-secondary" disabled={updating} onClick={() => useInstall.setState({ update: null })}>Later</button>
    </div>
  )
}
