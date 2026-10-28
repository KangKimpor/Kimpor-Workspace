import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { syncGlassToDocument } from './lib/glass'
import './styles/index.css'
import { hasStoredSession } from './lib/supabase'
import { useWorkspace } from './data'
import { afterFirstPaint } from './lib/paint'
import { workspaceStart } from './shell/landing'

syncGlassToDocument()
// Keep app gestures at a fixed scale; browser menu and OS magnification remain available.
document.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}, { passive: false })
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false })
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault()
})
const render = () => {
  if (location.pathname === '/') {
    const { scope, projects } = useWorkspace.getState()
    history.replaceState(history.state, '', workspaceStart(scope, projects))
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
const FIRST_PAINT_WAIT_MS = 3000
const initialize = () =>
  import('./data/sync').then((module) => module.initializeData())
if (
  hasStoredSession() ||
  /^\/settings\/(account|accounts)/.test(location.pathname)
) {
  // Signed-in users wait briefly so the right account paints first, but a slow or blocked
  // connection must never leave a blank page: initialization carries on after first paint.
  void Promise.race([initialize().catch(() => {}), new Promise((resolve) => setTimeout(resolve, FIRST_PAINT_WAIT_MS))]).then(render)
} else {
  render()
  let guestInitialized = false
  const initializeGuest = () => {
    if (guestInitialized) return
    guestInitialized = true
    removeEventListener('click', initializeGuest, true)
    removeEventListener('keydown', initializeGuest, true)
    void initialize().catch(() => useWorkspace.setState({ storageError: true }))
  }
  addEventListener('click', initializeGuest, { once: true, capture: true })
  addEventListener('keydown', initializeGuest, { once: true, capture: true })
  const ready = async () => {
    if (guestInitialized) return
    const databases = typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
      ? await indexedDB.databases().catch(() => null)
      : null
    if (!databases || databases.some((database) => database.name === 'kimpor-workspace')) {
      initializeGuest()
    }
  }
  afterFirstPaint(ready)
}
