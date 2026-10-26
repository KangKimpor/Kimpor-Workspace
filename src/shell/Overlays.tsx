import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMotionReduced, useSheetDrag } from '@/motion/hooks'
import { DURATION, EASE, REDUCED, SPRING, exitDuration } from '@/motion/tokens'

interface SideSheetProps {
  side: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  className: 'drawer' | 'rsheet'
  trigger?: ReactNode
  children: ReactNode
}

/** Overlay drawer (left) or right sheet on the Regular material over a dimmed scrim (§5, §11). */
export function SideSheet({
  side,
  open,
  onOpenChange,
  title,
  className,
  trigger,
  children,
}: SideSheetProps) {
  const reduced = useMotionReduced()
  const from = side === 'left' ? '-110%' : '110%'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: exitDuration(DURATION.base) },
                }}
                transition={{ duration: DURATION.base, ease: EASE.enter }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className={`glass ${className}`}
                data-material="regular"
                initial={reduced ? { opacity: 0 } : { x: from }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        x: from,
                        transition: {
                          duration: exitDuration(DURATION.base),
                          ease: EASE.exit,
                        },
                      }
                }
                transition={reduced ? REDUCED : SPRING.smooth}
              >
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
                <div className="drawer-dismiss">
                  <Dialog.Close
                    className="ibtn"
                    aria-label={`Close ${title.toLowerCase()}`}
                  >
                    <X size={20} />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}

interface BottomSheetProps {
  initial?: 'medium' | 'large'
  trigger?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

/** Touch bottom sheet: drag handle, medium (50%) and large (92%) detents, velocity dismissal (§11, §12). */
export function BottomSheet({
  initial = 'medium',
  trigger,
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      {open ? (
        <SheetBody title={title} initial={initial} onClose={() => onOpenChange(false)}>
          {children}
        </SheetBody>
      ) : null}
    </Dialog.Root>
  )
}

function SheetBody({
  initial,
  title,
  onClose,
  children,
}: {
  initial: 'medium' | 'large'
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const sheet = useSheetDrag({ onDismiss: onClose, initial })
  const { open, close } = sheet
  useEffect(() => {
    open(initial)
  }, [open, initial])

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="scrim" onClick={close} />
      <Dialog.Content
        asChild
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          if (initial === 'large') onClose()
          else close()
        }}
      >
        <motion.div
          className="glass bsheet"
          data-material="thick"
          {...sheet.sheetProps}
          onKeyDown={(e) => {
            if (initial === 'large' && e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }
          }}
        >
          <div className="grabber" role="presentation" {...sheet.handleProps} />
          <Dialog.Title
            className="t-h3"
            style={{ marginBottom: 'var(--space-12)' }}
          >
            {title}
          </Dialog.Title>
          {initial === 'large' && <button className="ibtn" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} style={{ position: 'absolute', top: 'var(--space-16)', right: 'var(--space-16)' }}><X size={18} /></button>}
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
