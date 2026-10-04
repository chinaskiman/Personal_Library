import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface FieldProps {
  /** Persian label. */
  label: string
  /** Optional Persian hint shown under the label. */
  hint?: string
  /** Validation message. Presence switches the field to its error state. */
  error?: string
  /** Renders the required marker and sets `aria-required`. */
  required?: boolean
  /** Extra classes for the wrapper. */
  className?: string
  /** The control itself — receives the ids it must wire up. */
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

/**
 * Label + control + error, wired for assistive tech.
 *
 * Render-prop based so one wrapper serves `<input>`, `<select>`, `<textarea>`
 * and custom controls. The error is referenced by `aria-describedby`, and the
 * message is rendered in a live region so it is announced when it appears.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-[0.8rem] font-medium text-ink"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-accent">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="text-[0.72rem] text-ink-faint">
          {hint}
        </p>
      ) : null}

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}

      {/* Polite live region: announces the message when validation fires. */}
      <p
        id={errorId}
        role="status"
        aria-live="polite"
        className={cn(
          'text-[0.72rem] leading-relaxed',
          error ? 'text-status-dropped' : 'sr-only',
        )}
      >
        {error ?? ''}
      </p>
    </div>
  )
}

/** Shared control styling so inputs and selects stay identical. */
export const CONTROL_CLASS =
  'w-full rounded-md border bg-surface-raised px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors duration-200 ease-editorial ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60'

/** Border + focus colours for the invalid / valid states. */
export function controlTone(hasError: boolean): string {
  return hasError
    ? 'border-status-dropped focus:border-status-dropped focus:ring-status-dropped/20'
    : 'border-line hover:border-line-strong focus:border-accent'
}