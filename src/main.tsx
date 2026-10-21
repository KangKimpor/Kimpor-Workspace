import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { syncGlassToDocument } from './lib/glass'
import './styles/index.css'
import { useInstall } from './lib/install'
import { hasStoredSession } from './lib/supabase'
import { useWorkspace } from './data'
import { afterFirstPaint } from './lib/paint'

syncGlassToDocument()
// Keep app gestures at a fixed scale; browser menu and OS magnification remain available.
document.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}, { passive: false })
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false })
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault()
})
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !registration.installing)
        void registration.update().catch(() => {})
    }
    addEventListener('focus', check)
    addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    setInterval(check, 60_000)
    check()
  },
  // Reload only the tab that requested it, including its first installation session.
  onNeedReload() {},
  onNeedRefresh() {
    useInstall.setState({
      update: async () => {
        const reload = () => location.reload()
        navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
        try {
          await updateSW(true)
        } catch (error) {
          navigator.serviceWorker.removeEventListener('controllerchange', reload)
          throw error
        }
      },
    })
  },
})

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
const initialize = () =>
  import('./data/sync').then((module) => module.initializeData())
if (
  hasStoredSession() ||
  /^\/settings\/(account|accounts)/.test(location.pathname)
) {
  void initialize().finally(render)
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
