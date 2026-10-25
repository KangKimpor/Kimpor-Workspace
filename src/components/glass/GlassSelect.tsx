import './GlassSelect.css'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { Children, isValidElement, useId, useLayoutEffect, useRef, useState } from 'react'
import { statusColor, tint } from '@/components/WorkspaceUI'
import type { Priority, TaskStatus } from '@/data'
import type { ReactNode, SelectHTMLAttributes } from 'react'

type Choice = { value: string; label: ReactNode; disabled?: boolean; group?: string }
function choices(children: ReactNode, group?: string): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return []
    if (child.type === 'optgroup') return choices(child.props.children, child.props.label)
    return [{ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled, group }]
  })
}

/** Native select remains the form value; the floating menu provides the visual control. */
export function GlassSelect({ children, value, defaultValue, onChange, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const select = useRef<HTMLSelectElement>(null)
  const control = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const ariaLabel = props['aria-label']
  const [label, setLabel] = useState(ariaLabel)
  useLayoutEffect(() => {
    const parent = select.current?.closest('label') ?? control.current?.labels?.[0]
    if (!ariaLabel && parent) setLabel([...parent.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' ').trim())
  }, [ariaLabel])
  const options = choices(children)
  const current = String(value ?? uncontrolled ?? options[0]?.value ?? '')
  const pill = (value: string, label: ReactNode) => {
    const color = statusColor[value as TaskStatus] ?? ({ Low: 'green', Medium: 'yellow', High: 'red', Urgent: 'red' } as const)[value as Priority]
    return color ? <span className="status-badge" style={tint(color)}>{label}</span> : label
  }
  const selected = options.find((option) => option.value === current)
  const choose = (next: string) => {
    if (!select.current) return
    select.current.value = next
    select.current.dispatchEvent(new Event('change', { bubbles: true }))
    setUncontrolled(next)
    setOpen(false)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <select {...props} id={undefined} ref={select} hidden aria-hidden="true" tabIndex={-1} value={value} defaultValue={defaultValue} onChange={onChange}>{children}</select>
      <Popover.Trigger asChild>
        <button type="button" ref={control} id={props.id} className={`glass-select ${className}`} role="combobox" aria-label={ariaLabel ?? label} aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" disabled={props.disabled} onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) }
        }}><span>{pill(current, selected?.label)}</span><ChevronDown size={13} aria-hidden="true" /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="glass glass-select-menu" data-material="thick" align="start" sideOffset={8} collisionPadding={12} onOpenAutoFocus={(e) => {
          e.preventDefault()
          list.current?.querySelector<HTMLElement>('[aria-selected="true"]:not(:disabled),[role="option"]:not(:disabled)')?.focus()
        }}>
          <div ref={list} id={id} role="listbox" tabIndex={-1} aria-label={ariaLabel ?? label} onKeyDown={(e) => {
            const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')]
            const index = items.indexOf(document.activeElement as HTMLButtonElement)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (index + 1) % items.length : e.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : -1
            if (next >= 0) { e.preventDefault(); items[next]?.focus() }
            else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== ' ') items.find((item) => item.textContent?.trim().toLowerCase().startsWith(e.key.toLowerCase()))?.focus()
          }}>
            {options.map((option, index) => <div key={`${option.group || ''}:${option.value}`} role="presentation">
              {option.group && option.group !== options[index - 1]?.group && <p className="glass-select-group">{option.group}</p>}
              <button type="button" className="glass-select-option" role="option" aria-selected={current === option.value} disabled={option.disabled} tabIndex={-1} onClick={() => choose(option.value)}><span>{pill(option.value, option.label)}</span>{current === option.value && <Check size={14} aria-hidden="true" />}</button>
            </div>)}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
