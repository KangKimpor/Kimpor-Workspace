import './ui.css'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { percent } from '../format'
import type { WbsRow } from '../wbs-table'
import type { NbcActivity } from '../types'

export interface WbsTableProps {
  rows: WbsRow[]
  caption: string
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  previous: (a: NbcActivity) => number
  current: (row: WbsRow) => ReactNode
  remark?: (row: WbsRow) => ReactNode
  extra?: { header: string; cell: (row: WbsRow) => ReactNode }[]
  rowAttrs?: (row: WbsRow) => Record<string, string | boolean | undefined>
  virtual?: boolean
  onRowClick?: (row: WbsRow) => void
  nameSuffix?: (row: WbsRow) => ReactNode
}

const ROW = 36

export function WbsTable({ rows, caption, collapsed, onToggle, previous, current, remark, extra = [], rowAttrs, virtual = false, onRowClick, nameSuffix }: WbsTableProps) {
  const scroll = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtualizer = useVirtualizer({ count: virtual ? rows.length : 0, getScrollElement: () => scroll.current, estimateSize: () => ROW, overscan: 12, initialRect: { width: 1200, height: 800 } })
  const items = virtual ? virtualizer.getVirtualItems() : rows.map((_, index) => ({ index, start: 0, end: 0 }))
  const before = virtual && items.length ? items[0]!.start : 0
  const after = virtual && items.length ? virtualizer.getTotalSize() - items.at(-1)!.end : 0
  const columns = 4 + (remark ? 1 : 0) + extra.length
  return <div className="nbc-wbs-scroll" ref={scroll}><table className="nbc-wbs"><caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col">WBS</th><th scope="col">Description</th><th scope="col" className="nbc-num">Previous week %</th><th scope="col" className="nbc-num">This week %</th>{remark && <th scope="col">Remark</th>}{extra.map((c) => <th scope="col" key={c.header}>{c.header}</th>)}</tr></thead>
    <tbody>
      {before > 0 && <tr aria-hidden="true"><td aria-hidden="true" colSpan={columns} style={{ height: before, padding: 0, border: 0 }}/></tr>}
      {items.map(({ index }) => {
        const row = rows[index]!, a = row.activity, open = !collapsed.has(a.id)
        return <tr key={a.id} data-level={row.level} data-group={row.group} data-wbs={a.wbs} {...rowAttrs?.(row)}>
          <td className="nbc-wbs-no">{a.wbs}</td>
          <td style={{ paddingInlineStart: `${row.depth * 16 + 8}px` }}><div className="nbc-desc">
            {row.group ? <button className="nbc-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${a.wbs}`} onClick={(e) => { e.stopPropagation(); onToggle(a.id) }}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="nbc-toggle-gap"/>}
            {onRowClick ? <button className="nbc-name nbc-name-button" onClick={() => onRowClick(row)}>{a.name}</button> : <span className="nbc-name">{a.name}</span>}{row.group && <span className="nbc-count">{row.leafCount}</span>}{a.wbs === 'GR&P' && <span className="nbc-pill" data-status="Shared">Shared</span>}{nameSuffix?.(row)}</div>
          </td>
          <td className="nbc-num">{percent(previous(a))}</td>
          <td className="nbc-num">{row.group ? percent(row.progress) : current(row)}</td>
          {remark && <td>{row.group ? null : remark(row)}</td>}
          {extra.map((c) => <td key={c.header}>{c.cell(row)}</td>)}
        </tr>
      })}
      {after > 0 && <tr aria-hidden="true"><td aria-hidden="true" colSpan={columns} style={{ height: after, padding: 0, border: 0 }}/></tr>}
    </tbody></table></div>
}
