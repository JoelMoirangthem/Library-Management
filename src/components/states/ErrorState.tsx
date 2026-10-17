import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { StateShell } from '@/components/states/StateShell'

type Props = {
  title?: string
  description?: string
  onRetry?: () => void
  /** True while a retry is in flight, so the button can't be hammered. */
  retrying?: boolean
}

/** The request failed and trying again may work. For "doesn't exist", use NotFoundState. */
export function ErrorState({
  title = "Couldn't load this",
  description = 'Check your connection and try again. Nothing you entered was lost.',
  onRetry,
  retrying = false,
}: Props) {
  return (
    <StateShell
      role="alert"
      tone="danger"
      icon={<TriangleAlert className="size-6" />}
      title={title}
      description={description}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            {!retrying && <RefreshCw aria-hidden className="size-4" />}
            Try again
          </Button>
        )
      }
    />
  )
}
