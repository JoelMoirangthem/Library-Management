import { CreditCard, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { ShiftBadge } from '@/components/ShiftTabs'
import { formatPhone, whatsappLink } from '@/domain/constants'
import type { Member, Shift } from '@/domain/types'
import { cx } from '@/lib/cx'

type RowProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  href?: string
}

/** A full-width 44px+ action row inside the sheet. Link or button. */
function ActionRow({ icon, label, onClick, danger, href }: RowProps) {
  const cls = cx(
    'flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-left text-base font-medium transition-colors',
    danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-canvas',
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>
        <span aria-hidden className="[&>svg]:size-5">{icon}</span>
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cx(cls, 'cursor-pointer')}>
      <span aria-hidden className="[&>svg]:size-5">{icon}</span>
      {label}
    </button>
  )
}

/**
 * Bottom-sheet list of the less-common student actions. The primary "Renew" stays on the
 * row; everything else lives here so the row never wraps at 320px.
 */
export function MemberActionsSheet({
  member,
  shift,
  reminderMessage,
  onClose,
  onEdit,
  onPayments,
  onRemove,
  canWrite,
}: {
  member: Member | null
  shift?: Pick<Shift, 'name'> & { isActive?: boolean }
  reminderMessage: (m: Member) => string
  onClose: () => void
  onEdit: () => void
  onPayments: () => void
  onRemove: () => void
  canWrite: boolean
}) {
  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={member ? member.name : 'Student'}
      description={member ? formatPhone(member.phone) : undefined}
    >
      {member && (
        <div className="space-y-1">
          <div className="mb-2 flex items-center gap-2">
            {shift && <ShiftBadge shift={shift} />}
          </div>
          <ActionRow
            icon={<MessageCircle />}
            label="Send WhatsApp reminder"
            href={whatsappLink(member.phone, reminderMessage(member))}
            onClick={onClose}
          />
          <ActionRow
            icon={<Phone />}
            label="Call"
            href={`tel:${member.phone}`}
            onClick={onClose}
          />
          {canWrite && (
            <>
              <ActionRow icon={<Pencil />} label="Edit details" onClick={onEdit} />
              <ActionRow icon={<CreditCard />} label="Payments" onClick={onPayments} />
              <ActionRow icon={<Trash2 />} label="Remove student" onClick={onRemove} danger />
            </>
          )}
          {!canWrite && (
            <ActionRow icon={<CreditCard />} label="Payments" onClick={onPayments} />
          )}
        </div>
      )}
    </Modal>
  )
}
