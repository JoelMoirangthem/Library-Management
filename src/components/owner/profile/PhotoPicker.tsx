import { useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { cx } from '@/lib/cx'

const MAX_PHOTOS = 4
const MAX_BYTES = 8 * 1024 * 1024
const MAX_WIDTH = 1000
const JPEG_QUALITY = 0.75

/** Resize an image file to a <=1000px-wide JPEG data URL, using a canvas (browser only). */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process this image.'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not a valid image.'))
    }
    img.src = url
  })
}

type Props = {
  photos: string[]
  onChange: (photos: string[]) => void
  disabled?: boolean
}

/** Up to 4 photos, resized client-side and stored as data URLs. */
export function PhotoPicker({ photos, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const id = useId()
  const atLimit = photos.length >= MAX_PHOTOS

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    const room = MAX_PHOTOS - photos.length
    const chosen = Array.from(files).slice(0, room)
    if (files.length > room) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`)
    }
    setWorking(true)
    const added: string[] = []
    for (const file of chosen) {
      if (file.size > MAX_BYTES) {
        setError('Each photo must be 8 MB or smaller. Try a smaller image.')
        continue
      }
      try {
        added.push(await resizeToDataUrl(file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not process that image.')
      }
    }
    setWorking(false)
    if (added.length) onChange([...photos, ...added])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <span id={id} className="mb-1.5 block text-sm font-medium">
        Photos
      </span>
      <p className="mb-3 text-sm text-ink-muted">
        Add up to {MAX_PHOTOS} photos of your library. Large photos are shrunk automatically.
      </p>

      {photos.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((src, i) => (
            <li key={src.slice(0, 32) + i} className="relative">
              <img
                src={src}
                alt={`Library photo ${i + 1}`}
                className="aspect-[4/3] w-full rounded-control border border-border object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((_, j) => j !== i))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        aria-describedby={id}
        className="sr-only"
        disabled={disabled || atLimit || working}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {!disabled && !atLimit && (
        <Button
          variant="secondary"
          loading={working}
          onClick={() => inputRef.current?.click()}
          className={cx(working && 'pointer-events-none')}
        >
          {!working && <ImagePlus aria-hidden className="size-4" />}
          Add photos
        </Button>
      )}
      {atLimit && !disabled && (
        <p className="text-sm text-ink-muted">You've added the maximum of {MAX_PHOTOS} photos.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
