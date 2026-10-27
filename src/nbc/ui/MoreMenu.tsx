import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassPopover } from '@/components/glass/GlassPopover'

export function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  return <GlassPopover label={label} trigger={<button className="ibtn" aria-label={label}><MoreHorizontal size={16}/></button>}><div className="nbc-more-menu">{children}</div></GlassPopover>
}
