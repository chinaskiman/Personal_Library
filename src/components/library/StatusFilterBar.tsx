import { READING_STATUS_META } from '@/data/readingStatus'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ReadingStatus } from '@/types/book'

/** `all` plus the three primary reading statuses. */
export type LibraryFilter = 'all' | ReadingStatus

export interface StatusFilterBarProps {
  value: LibraryFilter
  onChange: (filter: LibraryFilter) => void
  counts: Record<ReadingStatus, number> & { total: number }
}

const FILTERS: readonly { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'همهٔ کتاب‌ها' },
  { id: 'want-to-read', label: 'می‌خواهم بخوانم' },
  { id: 'reading', label: 'در حال مطالعه' },
  { id: 'finished', label: 'خوانده‌شده' },
] as const

/**
 * Status filter row.
 *
 * A single-choice group of toggle buttons rather than a tablist: these filter
 * one shared grid instead of swapping panels, and `aria-pressed` communicates
 * the on/off state of each filter correctly.
 */
export function StatusFilterBar({
  value,
  onChange,
  counts,
}: StatusFilterBarProps) {
  const countFor = (id: LibraryFilter) =>
    id === 'all' ? counts.total : counts[id]

  return (
    <div
      role="group"
      aria-label="فیلتر بر اساس وضعیت مطالعه"
      data-testid="status-filters"
      className="flex flex-wrap items-center gap-2"
    >
      {FILTERS.map((filter) => {
        const active = value === filter.id
        const meta = filter.id === 'all' ? null : READING_STATUS_META[filter.id]

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5',
              'text-[0.8rem] transition-all duration-200 ease-editorial',
              active
                ? 'border-accent bg-accent text-canvas shadow-paper'
                : 'border-line bg-surface-raised text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {meta ? (
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  // On the active state the dot must stay legible against the
                  // filled accent background.
                  active ? 'bg-canvas/80' : meta.dotClassName,
                )}
              />
            ) : null}
            {filter.label}
            <span
              className={cn(
                'tabular text-[0.72rem]',
                active ? 'text-canvas/75' : 'text-ink-faint',
              )}
            >
              {formatNumber(countFor(filter.id))}
            </span>
          </button>
        )
      })}
    </div>
  )
}