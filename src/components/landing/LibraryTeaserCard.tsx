import { Link } from 'react-router-dom'
import { Armchair, MapPin } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Card } from '@/components/Card'
import { LibraryArt } from '@/components/LibraryArt'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'

/** Per-shift seats text: text always carries the meaning, colour only reinforces it. */
function shiftSeatsLabel(seatsLeft: number): { tone: BadgeTone; label: string } {
  if (seatsLeft === 0) return { tone: 'neutral', label: 'Full' }
  if (seatsLeft <= 5) return { tone: 'warning', label: `${seatsLeft} free` }
  return { tone: 'success', label: `${seatsLeft} free` }
}

/** One compact row per active shift: name, time range and a seats pill (mirrors the Discover card). */
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

/**
 * Landing teaser card, built locally for the landing page (not imported from student).
 * Uses a LibraryArt cover of per-shift seat rows and the same per-shift rows as the
 * Discover cards, so a visitor sees which shifts have room before leaving the home page.
 */
export function LibraryTeaserCard({ library }: { library: PublicLibrary }) {
  const artShifts = library.shifts.map((s) => ({
    id: s.id,
    name: s.name,
    totalSeats: s.totalSeats,
    seatsLeft: s.seatsLeft,
  }))

  return (
    <Card className="group relative h-full overflow-hidden transition-colors hover:border-border-strong">
      <LibraryArt shifts={artShifts} className="h-28" />

      <div className="space-y-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">
            <Link
              to={`/library/${library.id}`}
              className="rounded-control outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
            >
              {library.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {library.areaName}, {library.cityName}
            </span>
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

        <p className="relative z-10 flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          <Armchair aria-hidden className="size-4" />
          View library
        </p>
      </div>
    </Card>
  )
}
