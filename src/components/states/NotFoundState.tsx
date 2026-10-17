import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'
import { StateShell } from '@/components/states/StateShell'

type Props = {
  title?: string
  description?: string
  /** Usually a link back to somewhere that exists. */
  action?: ReactNode
  heading?: 'h1' | 'h2'
}

/** The thing doesn't exist (or isn't visible to this user). Retrying won't help. */
export function NotFoundState({
  title = 'Not found',
  description = "This page or library doesn't exist, or it's no longer listed.",
  action,
  heading,
}: Props) {
  return (
    <StateShell
      icon={<SearchX className="size-6" />}
      title={title}
      description={description}
      action={action}
      heading={heading}
    />
  )
}
