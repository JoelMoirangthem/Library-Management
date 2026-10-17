import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Buttons row, e.g. Cancel + Save. */
  footer?: ReactNode
}

/**
 * Native <dialog>: focus trap, Esc to close and inert background come from the browser.
 * Bottom sheet on phones, centred card from `sm` up.
 */
export function Modal({ open, onClose, title, description, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-0 text-ink backdrop:bg-ink/40 sm:m-auto sm:rounded-card"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 cursor-pointer rounded-control p-2 text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
