import { cn } from '@/lib/cn'

export interface ProgressBarProps {
  /** 0–1 ratio. */
  value: number
  /** Optional Persian label announced to assistive tech. */
  label?: string
  className?: string
}

/**
 * A quiet reading-progress rule.
 * The fill grows from the inline-start edge, so it points the correct way
 * in both RTL and LTR without any extra logic.
 */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'relative h-1 w-full overflow-hidden rounded-full bg-surface-sunken',
        className,
      )}
    >
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-accent transition-[width] duration-500 ease-editorial"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
