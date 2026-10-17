import { Link } from 'react-router-dom'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Card } from '@/components/Card'
import { LibraryArt } from '@/components/LibraryArt'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'

/** Per-shift seats text: the text always carries the meaning, colour only reinforces it. */
function shiftSeatsLabel(seatsLeft: number): { tone: BadgeTone; label: string } {
  if (seatsLeft === 0) return { tone: 'neutral', label: 'Full' }
  if (seatsLeft <= 5) return { tone: 'warning', label: `${seatsLeft} free` }
  return { tone: 'success', label: `${seatsLeft} free` }
}

/** One compact row per active shift: name, time range and a seats pill (text always present). */
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
  const photo = library.photos[0]
  const allFull = library.shifts.length > 0 && library.shifts.every((s) => s.seatsLeft === 0)

  return (
    <Card className="group relative overflow-hidden transition-colors hover:border-border-strong">
      <div className="relative">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="h-40 w-full object-cover" />
        ) : (
          // Cover art built from the library's shifts when there's no photo.
          <LibraryArt shifts={library.shifts} className="h-40" />
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
            {/* The whole card is one real link via a stretched hit area. No nested links. */}
            <Link
              to={`/library/${library.id}`}
              className="line-clamp-2 break-words rounded-control outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
            >
              {library.name}
            </Link>
          </h3>
          <p className="mt-0.5 break-words text-sm text-ink-muted">
            {library.areaName}, {library.cityName}
          </p>
        </div>

        <p className="text-sm text-ink">
          <span className="text-ink-muted">from </span>
          <span className="font-semibold tabular-nums">{formatRupees(library.fromFeePaise)}</span>
          <span className="text-ink-muted"> for a month</span>
        </p>

        {library.shifts.length > 0 && (
          <ul className="space-y-1.5">
            {library.shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
