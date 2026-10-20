import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { syncGlassToDocument } from './lib/glass'
import './styles/index.css'
import './lib/install'
import { hasStoredSession } from './lib/supabase'
import { useWorkspace } from './data'

syncGlassToDocument()
registerSW({ immediate: true })

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
