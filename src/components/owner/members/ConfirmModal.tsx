import type { ReactNode } from 'react'
import { Button, type ButtonVariant } from '@/components/Button'
import { Modal } from '@/components/Modal'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel: string
  confirmVariant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  children?: ReactNode
}

/** A small yes/no dialog for destructive actions (remove student, decline request). */
export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  loading,
  onConfirm,
  children,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
