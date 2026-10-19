export { Glass, useSheen } from './Glass'
export type { GlassProps, Material } from './Glass'
export { GlassPanel } from './GlassPanel'
export { GlassButton } from './GlassButton'
export type { GlassButtonProps, ButtonStatus } from './GlassButton'
export { GlassPopover } from './GlassPopover'

/** Static ambient backdrop for glass to blur: three palette blobs, never animated (§10). */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  )
}
