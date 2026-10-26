import * as Popover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'

export interface GlassPopoverProps {
  /** The trigger element. Rendered with asChild, so pass a single focusable element. */
  trigger: ReactNode
  children: ReactNode
  label: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Popover on the Thick material, rendered in a portal at the end of <body> so a glass parent never
 * becomes its containing block (§10). Scales from 0.96 and fades from the trigger origin (§11).
 */
export function GlassPopover({ trigger, children, label, align = 'end', side = 'bottom', open, onOpenChange }: GlassPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="glass popover"
          data-material="thick"
          aria-label={label}
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            // An exiting menu must not steal focus from a menu opened immediately after it.
            const active = document.activeElement
            if (event.target instanceof HTMLElement && active instanceof HTMLElement && !event.target.contains(active) && (active.closest('.popover[data-state="open"]') || active.matches('[aria-haspopup][data-state="open"]'))) event.preventDefault()
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
