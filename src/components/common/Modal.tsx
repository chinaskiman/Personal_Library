import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Persian title, used for both the heading and `aria-labelledby`. */
  title: string
  /** Optional Persian supporting line under the title. */
  description?: string
  children: ReactNode
  /** Footer slot, kept outside the scrollable body. */
  footer?: ReactNode
  className?: string
}

/**
 * Accessible dialog.
 *
 * Handles the modal contract by hand rather than with `<dialog>`:
 * Escape to close, a real focus trap, focus restoration to the trigger on
 * close, background scroll lock, and a backdrop click target that only fires
 * on the backdrop itself (so a drag that ends outside a field does not close
 * the dialog mid-edit).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      // Keep Tab inside the dialog while it is open.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null

    // Move focus into the dialog on the next frame, so it lands after the
    // open transition rather than being fought by it.
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), button:not([data-close]), select, textarea',
        )
        ?.focus()
    })

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop. `onMouseDown` (not click) so text-selection drags that end
          outside the panel don't dismiss the dialog. */}
      <div
        className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-hidden="true"
        onMouseDown={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative my-4 w-full max-w-2xl overflow-hidden rounded-xl',
          'border border-line bg-canvas shadow-lift',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[0.8rem] text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="بستن پنجره"
            className="-me-1.5 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-surface hover:text-ink"
          >
            <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </button>
        </div>

        {/* The body scrolls; the header and footer stay put. */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="border-t border-line bg-surface/50 px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}