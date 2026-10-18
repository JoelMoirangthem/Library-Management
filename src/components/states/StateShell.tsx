import type { ReactNode } from 'react'

type Tone = 'neutral' | 'primary' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-border text-ink-muted',
  primary: 'bg-primary-soft text-primary-ink',
  danger: 'bg-danger-soft text-danger-ink',
}

type Props = {
  icon: ReactNode
  title: string
  description?: string
  /** Buttons or links. Keep it to one primary action. */
  action?: ReactNode
  tone?: Tone
  /** 'alert' announces immediately (errors); 'status' is polite. */
  role?: 'alert' | 'status'
  /** Use 'h1' when this is the main content of the page (e.g. a 404). */
  heading?: 'h1' | 'h2'
}

/**
 * The single layout behind every non-happy-path screen, so empty, error, not-found
 * and setup all look like one family and can be restyled in one place.
 */
export function StateShell({ icon, title, description, action, tone = 'neutral', role, heading: Heading = 'h2' }: Props) {
  return (
    <div
      role={role}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center motion-safe:animate-[rise_0.3s_ease-out]"
    >
      <div
        aria-hidden
        className={`mb-5 flex size-14 items-center justify-center rounded-full ${tones[tone]}`}
      >
        {icon}
      </div>
      <Heading className="text-xl font-semibold">{title}</Heading>
      {description && <p className="mt-2 text-ink-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}
