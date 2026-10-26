export const percent = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`
export const delta = (n: number) => Math.abs(n) < 1e-10 ? '0.0' : `${n > 0 ? '▲ +' : '▼ −'}${Math.abs(n * 100).toFixed(2)}`
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
export const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date.slice(0,10)}T12:00:00`))
export function exportReport(report: import('./types').NbcReport) {
  const cell = (v: string | number) => `"${String(typeof v === 'string' && /^[=+\-@\t\r\n]/.test(v) ? `'${v}` : v).replaceAll('"', '""')}"`
  const rows = [['Week ending', report.date], ['Overall progress', report.overall], ['Previous progress', report.previous], ['Correction of', report.correctionOf ?? ''], ['Reason', report.reason], ['Note',report.note ?? ''], [], ['WBS', 'Activity', 'Area', 'Handler', 'Previous', 'Actual', 'Difference', 'Global weight', 'Remark'], ...report.entries.map((e) => [e.wbs, e.name, e.area, e.handler, e.previous, e.progress, e.difference, e.weight, e.remark])]
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `NBC-BP03-${report.date}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
