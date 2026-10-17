import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { StateShell } from '@/components/states/StateShell'

type Props = {
  title: string
  description?: string
  /** The one thing the user can do about it, e.g. "Add your first student". */
  action?: ReactNode
}

/** Nothing here yet, and that's fine. Always offer the next step. */
export function EmptyState({ title, description, action }: Props) {
  return (
    <StateShell
      icon={<Inbox className="size-6" />}
      title={title}
      description={description}
      action={action}
    />
  )
}
