import { Skeleton } from '@/components/Skeleton'

type Props = {
  /** What is loading, read aloud to screen reader users. */
  label?: string
  /** 'list' = stacked rows (members, payments). 'cards' = grid of cards (libraries). */
  layout?: 'list' | 'cards'
  count?: number
}

export function LoadingState({ label = 'Loading', layout = 'list', count = 4 }: Props) {
  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <div role="status" aria-busy="true" className="w-full">
      <span className="sr-only">{label}…</span>
      {layout === 'list' ? (
        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          {items.map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i} className="space-y-3 rounded-card border border-border bg-surface p-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
