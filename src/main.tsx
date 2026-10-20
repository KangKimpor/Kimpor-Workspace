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
  onNeedRefresh() {
    useInstall.setState({ update: () => updateSW(true) })
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
  void initialize().catch(() => useWorkspace.setState({ storageError: true }))
}
