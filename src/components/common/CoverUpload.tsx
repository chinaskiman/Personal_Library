import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

import { BookCover } from '@/components/books/BookCover'
import { useStoredImage } from '@/hooks/useStoredImage'
import { saveImage } from '@/lib/imageStore'
import { cn } from '@/lib/cn'

/** Formats the browser will actually decode for us. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface CoverUploadProps {
  /** Persisted image reference (`idb:<key>`), or undefined. */
  value?: string
  /** Called with the new reference, or undefined when the image is removed. */
  onChange: (ref: string | undefined) => void
  /** Title, so the placeholder preview matches the card it will become. */
  bookTitle: string
  error?: string
  disabled?: boolean
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} مگابایت`
    : `${Math.max(1, Math.round(bytes / 1024))} کیلوبایت`
}

/**
 * Local image picker, shared by book covers and journal image notes.
 *
 * The file is written to IndexedDB and only its reference (`idb:<key>`) is held
 * in React state — a `blob:` URL is revoked as soon as the document unloads and
 * could never survive a refresh, so persisting one would leave a dead link. The
 * preview object URL is created by `useStoredImage`, which revokes it.
 */
export function CoverUpload({
  value,
  onChange,
  bookTitle,
  error,
  disabled,
}: CoverUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const { url, loading } = useStoredImage(value)

  const handleFile = async (file: File | undefined) => {
    if (!file) return

    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setMessage(
        'این نوع فایل پشتیبانی نمی‌شود. JPG، PNG، WebP، GIF یا AVIF بفرستید.',
      )
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage('حجم تصویر بیشتر از حد مجاز است.')
      return
    }

    setBusy(true)
    const ref = await saveImage(file)
    setBusy(false)

    if (!ref) {
      // Storage unavailable or full — the rest of the form stays usable.
      setMessage('ذخیرهٔ تصویر ممکن نشد؛ بدون تصویر ادامه می‌دهیم.')
      return
    }

    setMessage(null)
    setFileInfo(
      `${formatSize(file.size)} · ${file.type.replace('image/', '').toUpperCase()}`,
    )
    onChange(ref)
  }

  const clear = () => {
    onChange(undefined)
    setFileInfo(null)
    setMessage(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const shown = message ?? error
  const hasImage = Boolean(value)

  // Drop a stale description when the image is cleared elsewhere.
  useEffect(() => {
    if (!value) setFileInfo(null)
  }, [value])
return (
    <div className="space-y-1.5">
      <span className="block text-[0.8rem] font-medium text-ink">
        تصویر جلد
        <span className="ms-1.5 text-[0.72rem] font-normal text-ink-faint">
          (اختیاری)
        </span>
      </span>

      <div className="flex flex-wrap items-start gap-4">
        {/* Preview keeps the 3:4.4 ratio the shelf grid uses, so what the user
            sees here is what appears on the card. */}
        <div className="w-24 shrink-0">
          <BookCover
            seed={value ?? bookTitle ?? 'empty'}
            title={bookTitle || 'بدون عنوان'}
            src={url}
            alt={url ? `پیش‌نمایش جلد ${bookTitle}` : ''}
            className="aspect-[3/4.4] w-full"
          />
          {loading ? (
            <p className="mt-1 text-center text-[0.65rem] text-ink-faint">
              در حال بارگذاری…
            </p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <label
            onDragOver={(event) => {
              event.preventDefault()
              if (!disabled) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (!disabled) void handleFile(event.dataTransfer.files[0])
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5',
              'rounded-lg border border-dashed px-4 py-5 text-center',
              'transition-colors duration-200 ease-editorial',
              disabled
                ? 'cursor-not-allowed border-line bg-surface/20 opacity-60'
                : 'cursor-pointer',
              dragging
                ? 'border-accent bg-accent-wash/60'
                : 'border-line bg-surface/40 hover:border-line-strong hover:bg-surface/70',
            )}
          >
            <ImagePlus
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 text-accent"
            />
            <span className="text-[0.8rem] font-medium text-ink">
              انتخاب تصویر از دستگاه
            </span>
            <span className="text-[0.7rem] leading-relaxed text-ink-faint">
              یا فایل را اینجا رها کنید — JPG، PNG، WebP، GIF یا AVIF
            </span>
            <span className="text-[0.68rem] text-ink-faint">
              حداکثر {formatSize(MAX_IMAGE_BYTES)}
            </span>
          </label>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            disabled={disabled || busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="sr-only"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              className="h-8 rounded-md border border-line bg-surface-raised px-3 text-[0.78rem] text-ink transition-colors duration-200 hover:border-line-strong hover:bg-canvas-deep disabled:opacity-60"
            >
              {busy
                ? 'در حال ذخیره…'
                : hasImage
                  ? 'جایگزینی تصویر'
                  : 'انتخاب فایل'}
            </button>

            {hasImage ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={clear}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-3 text-[0.78rem] text-ink-soft transition-colors duration-200 hover:border-status-dropped/40 hover:text-status-dropped disabled:opacity-60"
              >
                <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                حذف تصویر
              </button>
            ) : null}

            {fileInfo && !shown ? (
              <span className="tabular text-[0.7rem] text-ink-faint">{fileInfo}</span>
            ) : null}
          </div>

          {/* Images never leave the device — say so where the user can see it. */}
          <p className="text-[0.7rem] leading-relaxed text-ink-faint">
            تصویر روی همین دستگاه ذخیره می‌شود و به جایی ارسال نمی‌گردد.
          </p>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'text-[0.72rem] leading-relaxed',
          shown ? 'text-status-dropped' : 'sr-only',
        )}
      >
        {shown ?? ''}
      </p>
    </div>
  )
}