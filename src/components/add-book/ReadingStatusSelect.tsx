import { ProgressBar } from '@/components/common/ProgressBar'
import { READING_STATUS_META } from '@/data/readingStatus'
import { toPersianDigits } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ADDABLE_STATUSES } from '@/types/catalog'
import type { ReadingStatus } from '@/types/book'

export interface ReadingStatusSelectProps {
  value: ReadingStatus
  onChange: (status: ReadingStatus) => void
  /** Raw text, so the user can clear the field while typing. */
  progressPercent: string
  onProgressChange: (value: string) => void
  progressError?: string
}

/**
 * Status picker as a radio group.
 *
 * Radios (rather than buttons) so arrow keys move between options and screen
 * readers announce the group as a single choice. The progress field only
 * appears for `reading`, so progress is never asked for when meaningless.
 */
export function ReadingStatusSelect({
  value,
  onChange,
  progressPercent,
  onProgressChange,
  progressError,
}: ReadingStatusSelectProps) {
  const isReading = value === 'reading'
  const numeric = Number(progressPercent)
  const preview = Number.isFinite(numeric)
    ? Math.min(Math.max(numeric, 0), 100)
    : 0

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-[0.8rem] font-medium text-ink">
        وضعیت مطالعه
        <span aria-hidden="true" className="ms-1 text-accent">
          *
        </span>
      </legend>

      <div className="grid gap-2 sm:grid-cols-3">
        {ADDABLE_STATUSES.map((status) => {
          const meta = READING_STATUS_META[status]
          const selected = value === status
          return (
            <label
              key={status}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5',
                'transition-colors duration-200 ease-editorial',
                selected
                  ? 'border-accent bg-accent-wash/50'
                  : 'border-line bg-surface-raised hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="reading-status"
                value={status}
                data-testid={`status-${status}`}
                checked={selected}
                onChange={() => onChange(status)}
                className="size-3.5 shrink-0 [accent-color:var(--color-accent)]"
              />
              <span
                className={cn(
                  'text-[0.8rem]',
                  selected ? 'font-medium text-ink' : 'text-ink-soft',
                )}
              >
                {meta.label}
              </span>
            </label>
          )
        })}
      </div>

      {isReading ? (
        <div className="space-y-2 rounded-md border border-line-soft bg-surface/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="progress-percent"
              className="text-[0.78rem] font-medium text-ink"
            >
              درصد پیشرفت خواندن
              <span className="ms-1.5 text-[0.72rem] font-normal text-ink-faint">
                (اختیاری)
              </span>
            </label>
            <span className="tabular text-[0.78rem] text-ink-soft">
              {progressPercent ? `${toPersianDigits(progressPercent)}٪` : '—'}
            </span>
          </div>

          <input
            id="progress-percent"
            type="range"
            min={0}
            max={100}
            step={1}
            value={preview}
            onChange={(event) => onProgressChange(event.target.value)}
            className="w-full [accent-color:var(--color-accent)]"
            aria-describedby={progressError ? 'progress-error' : undefined}
          />

          <ProgressBar
            value={preview / 100}
            label="پیش‌نمایش درصد پیشرفت"
          />

          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            value={progressPercent}
            onChange={(event) => onProgressChange(event.target.value)}
            placeholder="مثلاً ۴۰"
            aria-label="درصد پیشرفت خواندن (عدد)"
            aria-invalid={Boolean(progressError)}
            aria-describedby={progressError ? 'progress-error' : undefined}
            className={cn(
              'tabular w-28 rounded-md border bg-surface-raised px-3 py-1.5 text-sm text-ink',
              'placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/25',
              progressError
                ? 'border-status-dropped focus:border-status-dropped'
                : 'border-line hover:border-line-strong focus:border-accent',
            )}
          />

          <p
            id="progress-error"
            role="status"
            aria-live="polite"
            className={cn(
              'text-[0.72rem]',
              progressError ? 'text-status-dropped' : 'sr-only',
            )}
          >
            {progressError ?? ''}
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}