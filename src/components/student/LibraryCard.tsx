import { Link } from 'react-router-dom'
import { Armchair } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { CardBody, CardFooter, GridCard } from '@/components/CardGrid'
import { LibraryArt } from '@/components/LibraryArt'
import { Skeleton } from '@/components/Skeleton'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'

/** Per-shift seats text: the text always carries the meaning, colour only reinforces it. */
function shiftSeatsLabel(seatsLeft: number): { tone: BadgeTone; label: string } {
  if (seatsLeft === 0) return { tone: 'neutral', label: 'Full' }
  if (seatsLeft <= 5) return { tone: 'warning', label: `${seatsLeft} free` }
  return { tone: 'success', label: `${seatsLeft} free` }
}

/** One compact row: name + time range left, a seats pill right. Fixed height so rows align. */
function ShiftRow({ shift }: { shift: PublicShift }) {
  const seats = shiftSeatsLabel(shift.seatsLeft)
  return (
    <li className="flex h-10 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{shift.name}</p>
        <p className="truncate text-xs tabular-nums text-ink-muted">{formatShiftRange(shift)}</p>
      </div>
      <Badge tone={seats.tone}>{seats.label}</Badge>
    </li>
  )
}

/** Invisible placeholder with the exact height of a real row, so every card reserves 3 rows. */
function ShiftRowPlaceholder() {
  return <li aria-hidden className="h-10" />
}

/**
 * One library card, identical in height and internal layout regardless of data.
 * Used on both Discover and the Home teaser. Must sit inside a `GridItem` from CardGrid.
 */
export function LibraryCard({ library }: { library: PublicLibrary }) {
  const photo = library.photos[0]
  const allFull = library.shifts.length > 0 && library.shifts.every((s) => s.seatsLeft === 0)
  // Always render exactly three rows: real shifts first, then invisible placeholders.
  const shifts = library.shifts.slice(0, 3)
  const placeholders = Math.max(0, 3 - shifts.length)

  return (
    <GridCard className="group relative overflow-hidden transition-colors hover:border-border-strong">
      {/* Fixed-height cover: photo or shift art, rows evenly distributed for 1, 2 or 3 shifts. */}
      <div className="relative h-36">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="h-36 w-full object-cover" />
        ) : (
          <LibraryArt shifts={library.shifts} className="h-36 !justify-evenly" />
        )}
        {allFull && (
          <div className="absolute right-3 top-3">
            <Badge tone="neutral">All shifts full</Badge>
          </div>
        )}
      </div>

      <CardBody className="flex flex-col gap-3">
        <div>
          <h3 className="min-h-[2.75rem] text-lg font-semibold leading-tight">
            {/* The whole card is one real link via a stretched hit area. No nested links. */}
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

        <p className="text-sm text-ink">
          <span className="text-ink-muted">from </span>
          <span className="font-semibold tabular-nums">{formatRupees(library.fromFeePaise)}</span>
          <span className="text-ink-muted"> for a month</span>
        </p>

        {/* Always reserves three rows so prices and footers line up across every card. */}
        <ul className="mt-auto">
          {shifts.map((s) => (
            <ShiftRow key={s.id} shift={s} />
          ))}
          {Array.from({ length: placeholders }, (_, i) => (
            <ShiftRowPlaceholder key={`ph-${i}`} />
          ))}
        </ul>
      </CardBody>

      <CardFooter>
        <span className="relative z-10 flex items-center gap-1.5 text-sm font-medium text-primary">
          <Armchair aria-hidden className="size-4" />
          View library
        </span>
      </CardFooter>
    </GridCard>
  )
}

/** Skeleton that mirrors LibraryCard's fixed structure, so loading and loaded rows match height. */
export function LibraryCardSkeleton() {
  return (
    <GridCard className="overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <CardBody className="flex flex-col gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-4 w-2/5" />
        <ul className="mt-auto">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex h-10 items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFooter>
        <Skeleton className="h-5 w-28" />
      </CardFooter>
    </GridCard>
  )
}
