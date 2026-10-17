import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import type { Member } from '@/domain/types'
import { hasErrors, validateMemberFields } from '@/domain/validation'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'

type Props = {
  open: boolean
  onClose: () => void
  member: Member | null
  onSaved?: () => void
}

export function EditStudentModal({ open, onClose, member, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open || !member) return
    setName(member.name)
    setPhone(member.phone)
    setTouched(false)
  }, [open, member])

  const save = useMutation(
    (patch: { name: string; phone: string }) => services.updateMember(member!.id, patch),
    {
      success: 'Changes saved',
      onSuccess: () => {
        onSaved?.()
        onClose()
      },
    },
  )

  if (!member) return null

  const errors = validateMemberFields(name, phone)
  const submit = async () => {
    setTouched(true)
    if (hasErrors(errors)) return
    await save.run({ name: name.trim(), phone: phone.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${member.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={save.loading}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={touched ? errors.name : undefined}
          autoComplete="off"
        />
        <TextField
          label="Phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={touched ? errors.phone : undefined}
          hint="10-digit mobile number"
          autoComplete="off"
        />
      </div>
    </Modal>
  )
}
