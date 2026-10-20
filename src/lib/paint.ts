export function afterFirstPaint(callback: () => void) {
  if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
    const observer = new PerformanceObserver((entries) => {
      if (entries.getEntries().some((entry) => entry.name === 'first-contentful-paint')) {
        observer.disconnect()
        callback()
      }
    })
    observer.observe({ type: 'paint', buffered: true })
    return () => observer.disconnect()
  }
  let timer = 0
  const frame = requestAnimationFrame(() => { timer = window.setTimeout(callback, 0) })
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
  }
}
