import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { StateShell } from '@/components/states/StateShell'

type Props = {
  title?: string
  description?: string
  /** The step that finishes setup, e.g. "Add library details". */
  action?: ReactNode
}

/** The user hasn't finished onboarding. Not an error: point at the next step. */
export function SetupState({
  title = 'Set up your library',
  description = 'Add your library details to start managing seats, students and fees.',
  action,
}: Props) {
  return (
    <StateShell
      tone="primary"
      icon={<Building2 className="size-6" />}
      title={title}
      description={description}
      action={action}
    />
  )
}
