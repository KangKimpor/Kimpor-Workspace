import { confirmationTime } from '../format'

export type UpdateStatus = 'Updated' | 'Updated late' | 'Not yet' | 'Overdue' | 'Needs review'

/** Soft tinted pill; the text label always accompanies the colour. */
export function StatusPill({ status, time }: { status: UpdateStatus; time?: string | null }) {
  return <span className="nbc-pill" data-status={status}>{status}{time && <span className="nbc-pill-time">{confirmationTime(time)}</span>}</span>
}
