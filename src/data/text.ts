export function htmlText(value: string): string {
  const template = document.createElement('template')
  template.innerHTML = value.replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, '\n')
  template.content.querySelectorAll('script,style').forEach((node) => node.remove())
  return template.content.textContent?.trim() || ''
}
export function contentText(value: unknown): string {
  if (Array.isArray(value))
    return value.map(contentText).filter(Boolean).join(' ')
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  if (typeof node.text === 'string') return node.text
  if (node.type === 'pageMention')
    return String((node.props as { title?: string })?.title || '')
  return [contentText(node.content), contentText(node.children)]
    .filter(Boolean)
    .join(' ')
}
export function searchRank(query: string, title: string, body = ''): number {
  const normalize = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const q = normalize(query.trim()),
    name = normalize(title)
  if (!q || name === q) return 0
  if (name.startsWith(q)) return 1
  if (name.includes(q)) return 2
  if (
    q.split(/\s+/).every((word) => normalize(`${title} ${body}`).includes(word))
  )
    return 3
  let index = 0,
    gaps = 0
  for (const character of q) {
    const next = name.indexOf(character, index)
    if (next < 0) return Infinity
    gaps += next - index
    index = next + 1
  }
  return q.length > 1 ? 4 + gaps / Math.max(1, name.length) : Infinity
}
