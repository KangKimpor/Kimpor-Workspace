import { Link } from 'react-router-dom'
import type { AttentionItem } from './insights'

/** The few things a manager should look at first, each linking to where it can be fixed. */
export function Attention({ items }: { items: AttentionItem[] }) {
  return <section className="nbc-attention" aria-label="Needs attention">
    <header className="row-between"><h2>Needs attention</h2><span className="small muted">Most urgent first</span></header>
    {items.length === 0
      ? <p className="nbc-attention-empty small muted" role="status">Nothing needs attention this week.</p>
      : <ul>{items.map((item) => <li key={item.id}>
          <i className="nbc-dot" data-tone={item.tone} aria-hidden="true"/>
          <span><strong>{item.title}</strong><span className="small muted">{item.detail}</span></span>
          {item.impact && <span className="nbc-impact" data-tone={item.tone}>{item.impact}</span>}
          <Link className="text-link small" to={item.to}>Open</Link>
        </li>)}</ul>}
  </section>
}
