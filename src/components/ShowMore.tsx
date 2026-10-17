import { Button } from '@/components/Button'

/** "Showing 25 of 59" with a button. Use under any long list. */
export function ShowMore({
  shown,
  total,
  onClick,
  noun = 'students',
}: {
  shown: number
  total: number
  onClick: () => void
  noun?: string
}) {
  if (shown >= total) return null
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-sm tabular-nums text-ink-muted">
        Showing {shown} of {total} {noun}
      </p>
      <Button variant="secondary" onClick={onClick}>
        Show more
      </Button>
    </div>
  )
}
