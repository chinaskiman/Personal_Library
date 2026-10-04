import { cn } from '@/lib/cn'

export interface StatTileProps {
  label: string
  value: string
  /** Optional Persian clarifier under the value. */
  hint?: string
  /**
   * Rendered instead of `value` when the figure cannot be computed honestly.
   * Use for "not enough data yet" rather than showing a misleading zero.
   */
  unavailable?: string
  className?: string
}

/**
 * One figure in the insights grid.
 *
 * The value is a large serif figure so the grid reads as a quiet table rather
 * than a dashboard of competing widgets. `unavailable` exists because an
 * unknown number and a zero are different claims, and only one of them is
 * usually true.
 */
export function StatTile({
  label,
  value,
  hint,
  unavailable,
  className,
}: StatTileProps) {
  return (
    <div
      data-testid={`stat-${label}`}
      className={cn(
        'rounded-lg border border-line-soft bg-surface-raised px-4 py-4 shadow-paper',
        className,
      )}
    >
      <p className="text-[0.72rem] text-ink-soft">{label}</p>

      {unavailable ? (
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-faint">
          {unavailable}
        </p>
      ) : (
        <p className="tabular mt-1.5 font-serif text-2xl leading-none font-semibold text-ink">
          {value}
        </p>
      )}

      {hint && !unavailable ? (
        <p className="mt-1.5 text-[0.68rem] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
}