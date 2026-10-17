import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { formatRupees } from '@/domain/money'
import type { PublicLibrary } from '@/domain/types'

/** Per-shift free count, e.g. 'Morning full' or 'Afternoon 18 free'. */
function shiftFreeLabel(name: string, seatsLeft: number): string {
  return seatsLeft === 0 ? `${name} full` : `${name} ${seatsLeft} free`
}

/**
 * Landing teaser card. Shows the library's lowest active-shift fee as "from ₹X / month"
 * and a per-shift free count, so a visitor sees which shifts have room. Built locally for
 * the landing page against the shift-aware PublicLibrary type.
 */
export function LibraryTeaserCard({ library }: { library: PublicLibrary }) {
  return (
    <Link
      to={`/library/${library.id}`}
      className="group block h-full rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong"
    >
      <h3 className="text-base font-semibold text-ink group-hover:text-primary">{library.name}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
        <MapPin aria-hidden className="size-4 shrink-0" />
        {library.areaName}, {library.cityName}
      </p>

      <ul className="mt-4 space-y-1 text-sm">
        {library.shifts.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 tabular-nums">
            <span className={s.seatsLeft === 0 ? 'text-ink-muted' : 'font-medium text-primary-ink'}>
              {shiftFreeLabel(s.name, s.seatsLeft)}
            </span>
            <span className="text-ink-muted">{formatRupees(s.monthlyFeePaise)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-ink-muted tabular-nums">
        from {formatRupees(library.fromFeePaise)}
        <span className="text-ink-muted"> / month</span>
      </p>
    </Link>
  )
}
