import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getSupportEmail } from '@/lib/env'

/**
 * Shared layout for the three legal pages (Privacy, Terms, Refund). Clean prose column,
 * a "Last updated" line, a pilot-draft note, and a support contact. The page passes its
 * own <h2> sections as children; the single <h1> lives here so heading order is correct.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string
  lastUpdated: string
  intro: ReactNode
  children: ReactNode
}) {
  const supportEmail = getSupportEmail()
  return (
    <div className="mx-auto max-w-prose px-4 py-10 sm:px-6">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to home
      </Link>

      <article className="mt-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted tabular-nums">Last updated {lastUpdated}</p>

        <p className="mt-4 rounded-card border border-border bg-primary-soft/50 px-4 py-3 text-sm text-ink-muted">
          Draft for the pilot, to be reviewed before public launch.
        </p>

        <div className="legal-prose mt-8 space-y-8 text-ink">{intro}</div>

        <div className="legal-prose mt-8 space-y-8 text-ink [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mt-2 [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:leading-relaxed">
          {children}
        </div>

        <footer className="mt-10 border-t border-border pt-6 text-sm text-ink-muted">
          <p>
            Questions about this page? Write to{' '}
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex min-h-11 items-center font-medium text-primary hover:text-primary-hover"
            >
              {supportEmail}
            </a>
            .
          </p>
        </footer>
      </article>
    </div>
  )
}
