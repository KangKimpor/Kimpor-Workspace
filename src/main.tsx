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

syncGlassToDocument()
const updateSW = registerSW({
  immediate: true,
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
  const ready = () => {
    void initialize().catch(() => useWorkspace.setState({ storageError: true }))
  }
  if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
    const observer = new PerformanceObserver((entries) => {
      if (entries.getEntries().some((entry) => entry.name === 'first-contentful-paint')) {
        observer.disconnect()
        ready()
      }
    })
    observer.observe({ type: 'paint', buffered: true })
  } else {
    requestAnimationFrame(() => setTimeout(ready, 0))
  }
}
