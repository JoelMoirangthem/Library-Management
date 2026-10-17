import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  Eye,
  IndianRupee,
  LayoutGrid,
  ListChecks,
  MapPin,
  Users,
} from 'lucide-react'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { SeatStrip } from '@/components/SeatGrid'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { HeroSeatGrid } from '@/components/landing/HeroSeatGrid'
import { formatRupees } from '@/domain/money'
import { PLAN_PRICE_PAISE } from '@/domain/plan'
import type { PublicLibrary } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { services } from '@/lib/container'

export default function Home() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <SeatsFreeNow />
      <OwnersSection />
      <Faq />
      <FinalCta />
    </div>
  )
}

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Find a study library with a free seat, or run yours without paper registers.
          </h1>
          <p className="mt-5 max-w-prose text-lg text-ink-muted">
            Students search by city and area and request a seat in a few taps. Owners track
            seats, students, fees and expiry dates in one place — on the phone, between
            students.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/discover" className={buttonStyles('primary', 'text-base')}>
              Find a library
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link to="/login?as=owner" className={buttonStyles('secondary', 'text-base')}>
              List your library
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            14 days free for owners. No card needed to start.
          </p>
        </div>

        <div className="relative">
          <Card className="bg-canvas p-5 sm:p-7">
            <HeroSeatGrid />
          </Card>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const studentSteps = [
    'Search by your city and area.',
    'Open a library and see how many seats are free.',
    'Request a seat; the owner confirms and you are in.',
  ]
  const ownerSteps = [
    'List your library and set your seats and fee.',
    'Add students or approve seat requests as they come.',
    'See who is paid, who is expiring, and who is overdue at a glance.',
  ]

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
      <p className="mt-2 max-w-prose text-ink-muted">
        Two sides, one simple flow. Students find a seat; owners keep the library running.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold">For students</h3>
          <ol className="mt-4 space-y-4">
            {studentSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/discover"
            className="mt-6 inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-primary hover:text-primary-hover"
          >
            Find a library
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold">For owners</h3>
          <ol className="mt-4 space-y-4">
            {ownerSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            to="/login?as=owner"
            className="mt-6 inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-primary hover:text-primary-hover"
          >
            List your library
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>
      </div>
    </section>
  )
}

function SeatsFreeNow() {
  const { data, error, loading, reload } = useAsync(() => services.searchLibraries({}), [])

  const top = (data ?? [])
    .slice()
    .sort((a, b) => b.seatsLeft - a.seatsLeft)
    .slice(0, 3)

  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Libraries with seats free now</h2>
            <p className="mt-2 max-w-prose text-ink-muted">
              A few open spots near our pilot cities. Tap one to see fees, timings and the seat map.
            </p>
          </div>
          <Link
            to="/discover"
            className="inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-primary hover:text-primary-hover"
          >
            See all libraries
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <LoadingState layout="cards" count={3} label="Loading libraries" />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : top.length === 0 ? (
            <EmptyState
              title="No open libraries yet"
              description="New libraries are being approved. Check the full list to search by your area."
              action={
                <Link to="/discover" className={buttonStyles('secondary')}>
                  Browse all libraries
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {top.map((lib) => (
                <li key={lib.id}>
                  <LibraryTeaserCard library={lib} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function LibraryTeaserCard({ library }: { library: PublicLibrary }) {
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

      <div className="mt-4">
        <SeatStrip total={library.totalSeats} free={library.seatsLeft} />
        <p className="mt-2 text-sm font-medium tabular-nums">
          <span className="text-primary-ink">{library.seatsLeft} free</span>
          <span className="text-ink-muted"> of {library.totalSeats} seats</span>
        </p>
      </div>

      <p className="mt-4 text-sm text-ink-muted tabular-nums">
        {formatRupees(library.monthlyFeePaise)}
        <span className="text-ink-muted"> / month</span>
      </p>
    </Link>
  )
}

function OwnersSection() {
  const benefits = [
    { icon: <LayoutGrid className="size-5" />, title: 'A live seat map', body: 'See free, occupied, expiring and overdue seats at a glance — no register to flip through.' },
    { icon: <Users className="size-5" />, title: 'Your student list', body: 'Every student with their seat, start date and expiry, searchable and sortable.' },
    { icon: <BellRing className="size-5" />, title: 'Expiry reminders', body: 'Know who is expiring in the next 7 days and who is already overdue, before they ask.' },
    { icon: <ClipboardCheck className="size-5" />, title: 'Fee records', body: 'Record each payment with date and mode. Nothing is deleted, so your history stays clean.' },
    { icon: <Eye className="size-5" />, title: 'Visible to students', body: 'An active library shows up in search with its free seats, so new students can find you.' },
  ]

  return (
    <section id="owners" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Run your library without registers
            </h2>
            <p className="mt-4 text-ink-muted">
              Start free for 14 days. Keep going for a flat {formatRupees(PLAN_PRICE_PAISE)} a month —
              one price, every feature, no per-student charge.
            </p>

            <Card className="mt-6 p-6">
              <p className="text-sm text-ink-muted">After your free trial</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tabular-nums">{formatRupees(PLAN_PRICE_PAISE)}</span>
                <span className="text-ink-muted">/ month</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink">
                <li className="flex items-center gap-2">
                  <IndianRupee aria-hidden className="size-4 text-primary" />
                  Pay by UPI, verified by our team — usually the same day.
                </li>
                <li className="flex items-center gap-2">
                  <ListChecks aria-hidden className="size-4 text-primary" />
                  Renew early and the days stack; you never lose time.
                </li>
              </ul>
              <Link to="/login?as=owner" className={buttonStyles('primary', 'mt-6 w-full')}>
                List your library
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <p className="mt-3 text-center text-sm text-ink-muted">14 days free. No card needed.</p>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold">What owners get</h3>
            <ul className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
              {benefits.map((b) => (
                <li key={b.title} className="flex gap-4 p-5">
                  <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                    {b.icon}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{b.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'How does the free trial work?',
    a: 'When your library is approved, you get 14 days free with every feature unlocked. Nothing is charged automatically — when the trial ends you choose whether to pay for a month.',
  },
  {
    q: 'How do I pay?',
    a: 'You pay ₹199 by UPI and enter the payment reference (UTR). An admin checks it by hand, usually the same day, and your month starts once it is verified.',
  },
  {
    q: 'What happens if my plan ends?',
    a: 'Your library is hidden from student search and your dashboard becomes read-only — you can still see everything, but you cannot make changes until you renew. Nothing is deleted; your students, seats and fee history stay exactly as they were.',
  },
  {
    q: 'Is it free for students?',
    a: 'Yes. Searching libraries and requesting a seat is completely free for students. Students pay their monthly fee directly to the library, not to StudySeat.',
  },
  {
    q: 'Can I use it on my phone?',
    a: 'Yes. StudySeat is built phone-first, so you can manage seats, students and fees one-handed between students. It works the same on a laptop.',
  },
  {
    q: 'How do I get approved?',
    a: 'After you list your library, an admin reviews the details — usually within 24 hours. Once approved, your free trial starts and your library can appear in search.',
  },
]

function Faq() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Questions, answered</h2>
        <div className="mt-8 divide-y divide-border rounded-card border border-border">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="pb-5 pr-8 text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="rounded-card border border-border bg-primary-soft p-8 text-center sm:p-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-prose text-ink-muted">
          Students, find your next seat. Owners, put your register away and start your 14 days free.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/discover" className={buttonStyles('primary', 'text-base')}>
            Find a library
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link to="/login?as=owner" className={buttonStyles('secondary', 'text-base')}>
            List your library
          </Link>
        </div>
      </div>
    </section>
  )
}
