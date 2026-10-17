import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

type Tone = 'success' | 'error' | 'info'
type ToastAction = { label: string; onClick: () => void }
type ToastOptions = {
  /** e.g. { label: 'Undo', onClick } for reversible actions. Keeps the toast up longer. */
  action?: ToastAction
}
type ToastItem = { id: number; message: string; tone: Tone; action?: ToastAction }
type ToastApi = { show: (message: string, tone?: Tone, options?: ToastOptions) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message: string, tone: Tone = 'info', options: ToastOptions = {}) => {
      const id = nextId.current++
      setItems((l) => [...l.slice(-2), { id, message, tone, action: options.action }])
      const ms = options.action ? 8000 : tone === 'error' ? 6000 : 3500
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Sits above the bottom tab bar on phones. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-control bg-ink px-4 py-3 text-sm text-white shadow-lg"
          >
            {t.tone === 'error' ? (
              <CircleAlert aria-hidden className="size-4 shrink-0" />
            ) : (
              <CircleCheck aria-hidden className="size-4 shrink-0" />
            )}
            <p className="flex-1">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="-my-2 min-h-11 cursor-pointer rounded-control px-3 font-semibold underline underline-offset-2 hover:bg-white/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-white/70 hover:text-white"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
