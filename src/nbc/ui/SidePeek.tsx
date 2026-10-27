import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** Right-hand read-only panel, in the manner of a Notion side peek. */
export function SidePeek({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="nbc-peek-scrim"/>
    <Dialog.Content className="nbc-peek" aria-describedby={undefined}>
      <header className="nbc-peek-head"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="ibtn" aria-label="Close"><X size={16}/></Dialog.Close></header>
      <div className="nbc-peek-body">{children}</div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
