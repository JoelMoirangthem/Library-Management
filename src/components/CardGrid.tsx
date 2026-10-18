import type { HTMLAttributes, ReactNode } from 'react'
import { Card } from '@/components/Card'
import { cardColumnsFor } from '@/domain/presentation'
import { cx } from '@/lib/cx'

/**
 * One grid for every set of cards, so they always line up:
 *  - every card in a row is exactly the same height (the grid stretches them),
 *  - every card is the same width (no card ever stretches to fill a lone last row),
 *  - the column count adapts to the screen AND to how many cards there are, so 4 cards
 *    become 2 x 2 instead of 3 + 1.
 *
 * Usage:
 *   <CardGrid count={items.length}>
 *     {items.map((x) => (
 *       <GridItem key={x.id}>
 *         <GridCard> <CardBody>...</CardBody> <CardFooter>actions</CardFooter> </GridCard>
 *       </GridItem>
 *     ))}
 *   </CardGrid>
 */
type Layout = 'one' | 'two' | 'three' | 'many' | 'four'

/** Which layout leaves no lonely card: 4 cards are 2 x 2 (never 3 + 1), 3 cards stay in one row or stack. */
export function layoutFor(count: number, max: 2 | 3 | 4 = 3): Layout {
  if (max === 3) {
    const columns = cardColumnsFor(count)
    if (columns === 1) return 'one'
    if (columns === 2) return 'two'
    return count === 3 ? 'three' : 'many'
  }
  if (count <= 1) return 'one'
  if (count === 2 || count === 4) return 'two'
  if (count === 3) return 'three'
  return max === 4 && count % 4 === 0 ? 'four' : max === 2 ? 'two' : 'many'
}

const LAYOUT: Record<Layout, string> = {
  // A single card keeps the normal card width instead of stretching across the page.
  one: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  two: 'grid-cols-1 md:grid-cols-2',
  // Three cards: one tidy row when there is room, otherwise a single column (never 2 + 1).
  three: 'grid-cols-1 xl:grid-cols-3',
  many: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  four: 'grid-cols-2 lg:grid-cols-4',
}
export function CardGrid({
  count,
  max = 3,
  className,
  children,
  ...rest
}: {
  /** Number of cards, used to pick a column count that leaves no orphan. */
  count: number
  max?: 2 | 3 | 4
  className?: string
  children: ReactNode
} & Omit<HTMLAttributes<HTMLUListElement>, 'className' | 'children'>) {
  return (
    <ul data-card-grid role="list" className={cx('grid items-stretch gap-4', LAYOUT[layoutFor(count, max)], className)} {...rest}>
      {children}
    </ul>
  )
}

/** Grid cell. `min-w-0` stops long names from widening one column. */
export function GridItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx('flex min-w-0', className)}>{children}</li>
}

/** A card that fills its grid cell. Put `CardFooter` last and it sticks to the bottom edge. */
export function GridCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cx('flex min-w-0 flex-1 flex-col', className)} {...rest} />
}

/** Padded content area that takes the free space, so footers line up across cards. */
export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('flex-1 p-4 sm:p-5', className)} {...rest} />
}

/** Actions row pinned to the bottom of the card, with a divider. */
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('mt-auto flex flex-wrap items-center gap-2 border-t border-border p-4 sm:px-5', className)} {...rest} />
}
