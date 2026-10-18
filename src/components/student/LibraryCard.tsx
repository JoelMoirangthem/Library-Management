import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { CardFooter, GridCard } from '@/components/CardGrid'
import { Skeleton } from '@/components/Skeleton'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'

/** The words carry the meaning; colour only reinforces it. */
function seatsLabel(seatsLeft: number): { tone: BadgeTone; label: string } {
  if (seatsLeft === 0) return { tone: 'neutral', label: 'Full' }
  if (seatsLeft <= 5) return { tone: 'warning', label: `${seatsLeft} free` }
  return { tone: 'success', label: `${seatsLeft} free` }
}

/** "GD" for "Gyan Deep Study Hub": a calm identity tile when the library has no photo. */
function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean)
  return (words[0]?.[0] ?? '?').toUpperCase() + (words[1]?.[0] ?? '').toUpperCase()
}

function Tile({ name, photo }: { name: string; photo?: string }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-primary-soft text-base font-semibold text-primary-ink">
      {photo ? <img src={photo} alt="" loading="lazy" className="size-full object-cover" /> : initialsOf(name)}
    </div>
  )
}

const ROW_H = 'h-11'

function ShiftRow({ shift }: { shift: PublicShift }) {
  const seats = seatsLabel(shift.seatsLeft)
  return (
    <li className={`flex items-center justify-between gap-3 border-t border-border ${ROW_H}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{shift.name}</p>
        <p className="truncate text-xs tabular-nums leading-tight text-ink-muted">{formatShiftRange(shift)}</p>
      </div>
      <Badge tone={seats.tone}>{seats.label}</Badge>
    </li>
  )
}

/**
 * The one library card (Discover and the Home teaser). Text only, fixed structure, so it is
 * the same size with 1, 2 or 3 shifts, a short or a long name, with or without a photo:
 *
 *   [GD]  Gyan Deep Study Hub
 *         Faizabad Road, Lucknow
 *   -----------------------------
 *   Morning    8:30 am to 12:30 pm      Full
 *   Afternoon  1:00 pm to 5:00 pm    31 free
 *   Evening    6:00 pm to 9:00 pm    27 free
 *   -----------------------------
 *   from ?700 / month               View >
 *
 * Always three shift rows; an empty one stays invisible. Must sit inside a CardGrid `GridItem`.
 */
export function LibraryCard({ library }: { library: PublicLibrary }) {
  const rows = library.shifts.slice(0, 3)
  const empty = Math.max(0, 3 - rows.length)

  return (
    <GridCard className="group relative transition-[border-color,box-shadow,transform] duration-200 hover:border-border-strong hover:shadow-lift motion-safe:hover:-translate-y-0.5">
      <div className="flex flex-1 flex-col gap-3 p-4 pb-2">
        <div className="flex items-center gap-3">
          <Tile name={library.name} photo={library.photos[0]} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight">
              {/* The whole card is one real link through a stretched hit area. No nested links. */}
              <Link
                to={`/library/${library.id}`}
                title={library.name}
                className="block truncate rounded-control outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
              >
                {library.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {library.areaName}, {library.cityName}
            </p>
          </div>
        </div>

        <ul aria-label="Seats free by shift" className="mt-auto">
          {rows.map((s) => (
            <ShiftRow key={s.id} shift={s} />
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} aria-hidden className={`invisible border-t ${ROW_H}`} />
          ))}
        </ul>
      </div>

      <CardFooter className="justify-between py-3">
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
      <div className="flex flex-1 flex-col gap-3 p-4 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <ul className="mt-auto">
          {[0, 1, 2].map((i) => (
            <li key={i} className={`flex items-center justify-between gap-3 border-t border-border ${ROW_H}`}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
      <CardFooter className="justify-between py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-10" />
      </CardFooter>
    </GridCard>
  )
}
