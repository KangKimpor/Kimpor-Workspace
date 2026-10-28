import { useEffect, useState } from 'react'

/** A plain-text weekly summary that can be copied into a report or message. */
export function Digest({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('')
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  async function copy() {
    try { await navigator.clipboard.writeText([title, '', ...lines].join('\n')); setCopied('yes') } catch { setCopied('no') }
  }
  return <div className="nbc-digest-scrim">
    <button className="nbc-digest-backdrop" tabIndex={-1} aria-label="Close digest" onClick={onClose}/>
    <div className="nbc-digest" role="dialog" aria-label="Weekly digest">
      <header className="row-between"><h3>Weekly digest</h3><button className="btn-secondary" onClick={onClose}>Close</button></header>
      <p className="small muted">{title}</p>
      <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
      <div className="nbc-digest-actions">
        <span className="small muted" role="status">{copied === 'yes' ? 'Copied to clipboard' : copied === 'no' ? 'Could not copy. Select the text instead.' : ''}</span>
        <button className="btn-accent" onClick={() => void copy()}>Copy summary</button>
      </div>
    </div>
  </div>
}
