import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CardFooter, GridCard } from '@/components/CardGrid'
import { SeatMark } from '@/components/Logo'
import { ShiftBars } from '@/components/LibraryArt'
import { Skeleton } from '@/components/Skeleton'
import { formatRupees } from '@/domain/money'
import type { PublicLibrary } from '@/domain/types'

/** 56px square: the first photo, or the seat mark when there is none. Always present, so every card has the same header. */
function Thumb({ photo }: { photo?: string }) {
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-canvas">
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <SeatMark className="size-8" />
      )}
    </div>
  )
}

/**
 * The one library card, used on Discover and the Home teaser. Fixed structure, so it is
 * the same size with 1, 2 or 3 shifts, a short or a long name, with or without a photo:
 *
 *   [thumb] Name (2 lines reserved)
 *           Area, City
 *   ┌ Morning  ████░░░░  18 free ┐   <- always 3 rows
 *   from ₹500 / month         View >
 *
 * Must sit inside a `GridItem` from CardGrid.
 */
export function LibraryCard({ library }: { library: PublicLibrary }) {
  return (
    <GridCard className="group relative transition-colors hover:border-border-strong">
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Thumb photo={library.photos[0]} />
          <div className="min-w-0 flex-1">
            <h3 className="min-h-[2.5rem] text-base font-semibold leading-tight">
              {/* The whole card is one real link through a stretched hit area. No nested links. */}
              <Link
                to={`/library/${library.id}`}
                className="line-clamp-2 break-words rounded-control outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
              >
                {library.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {library.areaName}, {library.cityName}
            </p>
          </div>
        </div>

        <ShiftBars shifts={library.shifts} tinted />
      </div>

      <CardFooter className="justify-between">
        <p className="text-sm">
          <span className="text-ink-muted">from </span>
          <span className="font-semibold tabular-nums">{formatRupees(library.fromFeePaise)}</span>
          <span className="text-ink-muted"> / month</span>
        </p>
        <span className="flex items-center gap-0.5 text-sm font-medium text-primary">
          View
          <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </CardFooter>
    </GridCard>
  )
}

/** Skeleton with the same structure and height as LibraryCard. */
export function LibraryCardSkeleton() {
  return (
    <GridCard>
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="size-14 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-7 items-center rounded-control bg-primary-soft px-3">
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
      <CardFooter className="justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-10" />
      </CardFooter>
    </GridCard>
  )
}
