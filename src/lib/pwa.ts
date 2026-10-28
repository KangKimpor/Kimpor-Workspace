import { registerSW } from 'virtual:pwa-register'
import { useInstall } from './install'

let registered = false
export function registerUpdates() {
  if (registered) return
  registered = true
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
}
