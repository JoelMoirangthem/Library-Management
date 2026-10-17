import { Link } from 'react-router-dom'
import { Armchair } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Card } from '@/components/Card'
import { SeatMark } from '@/components/Logo'
import { SeatStrip } from '@/components/SeatGrid'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'
import { cx } from '@/lib/cx'

/** Per-shift seats text: text always carries the meaning, colour only reinforces it. */
function shiftSeatsLabel(seatsLeft: number): { tone: BadgeTone; label: string } {
  if (seatsLeft === 0) return { tone: 'neutral', label: 'Full' }
  if (seatsLeft <= 5) return { tone: 'warning', label: `${seatsLeft} free` }
  return { tone: 'success', label: `${seatsLeft} free` }
}

/** A tasteful placeholder built from the seat motif when a library has no photo. */
function PhotoPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex h-40 items-center justify-center bg-primary-soft text-primary"
    >
      <SeatMark className="size-12 opacity-80" />
    </div>
  )
}

/** One compact row per active shift: name, time range and a seats pill. */
function ShiftRow({ shift }: { shift: PublicShift }) {
  const seats = shiftSeatsLabel(shift.seatsLeft)
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{shift.name}</p>
        <p className="text-xs tabular-nums text-ink-muted">{formatShiftRange(shift)}</p>
      </div>
      <Badge tone={seats.tone}>{seats.label}</Badge>
    </li>
  )
}

export function LibraryCard({ library }: { library: PublicLibrary }) {
  const extraAmenities = Math.max(0, library.amenities.length - 3)
  const photo = library.photos[0]

  const allFull = library.shifts.length > 0 && library.shifts.every((s) => s.seatsLeft === 0)
  // Keep one SeatStrip for the shift with the most free seats.
  const strongestShift = library.shifts.reduce<PublicShift | null>(
    (best, s) => (best === null || s.seatsLeft > best.seatsLeft ? s : best),
    null,
  )

  return (
    <Card className="group relative overflow-hidden transition-colors hover:border-border-strong">
      <div className="relative">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="h-40 w-full object-cover"
          />
        ) : (
          <PhotoPlaceholder />
        )}
        {allFull && (
          <div className="absolute right-3 top-3">
            <Badge tone="neutral">All shifts full</Badge>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <h3 className="text-lg font-semibold leading-tight">
            {/* Whole card clickable via a real link with a stretched hit area. */}
            <Link
              to={`/library/${library.id}`}
              className="rounded-control outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
            >
              {library.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {library.areaName}, {library.cityName}
          </p>
        </div>

        <p className="text-sm text-ink">
          <span className="text-ink-muted">from </span>
          <span className="font-semibold tabular-nums">{formatRupees(library.fromFeePaise)}</span>
          <span className="text-ink-muted"> / month</span>
        </p>

        {library.shifts.length > 0 && (
          <ul className="space-y-1.5">
            {library.shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </ul>
        )}

        {strongestShift && (
          <SeatStrip total={strongestShift.totalSeats} free={strongestShift.seatsLeft} />
        )}

        {library.amenities.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            {library.amenities.slice(0, 3).map((a) => (
              <li key={a} className="rounded-full bg-canvas px-2 py-0.5">
                {a}
              </li>
            ))}
            {extraAmenities > 0 && (
              <li className="rounded-full bg-canvas px-2 py-0.5 tabular-nums">+{extraAmenities}</li>
            )}
          </ul>
        )}

        <p className={cx('flex items-center gap-1.5 text-sm font-medium text-primary', 'relative z-10 w-fit')}>
          <Armchair aria-hidden className="size-4" />
          View library
        </p>
      </div>
    </Card>
  )
}
