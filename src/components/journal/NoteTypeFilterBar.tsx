import { Image as ImageIcon, Quote as QuoteIcon, Type } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { countByType, type NoteTypeFilter } from '@/lib/notes'
import type { Note } from '@/types/note'

const TYPE_ICONS = {
  text: Type,
  quote: QuoteIcon,
  image: ImageIcon,
} as const

/** Persian labels; `all` has no icon since it is not a note type. */
const FILTERS: readonly { id: NoteTypeFilter; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'text', label: 'یادداشت' },
  { id: 'quote', label: 'نقل‌قول' },
  { id: 'image', label: 'تصویر' },
] as const

export interface NoteTypeFilterBarProps {
  value: NoteTypeFilter
  onChange: (filter: NoteTypeFilter) => void
  /** The whole collection, so counts describe what exists, not what is filtered. */
  notes: readonly Note[]
}

/**
 * Note-type filter row.
 *
 * Built on the same toggle-button pattern as the library's status filter, since
 * these narrow one shared list rather than swapping panels. Counts always show
 * totals for the entire collection so the chips describe what is available
 * rather than shifting under the user's cursor as other filters change.
 */
export function NoteTypeFilterBar({
  value,
  onChange,
  notes,
}: NoteTypeFilterBarProps) {
  const counts = countByType(notes)

  return (
    <div
      role="group"
      aria-label="فیلتر بر اساس نوع یادداشت"
      data-testid="note-type-filters"
      className="flex flex-wrap items-center gap-2"
    >
      {FILTERS.map((filter) => {
        const active = value === filter.id
        const Icon = filter.id === 'all' ? null : TYPE_ICONS[filter.id]
        const count = counts[filter.id]

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            disabled={count === 0 && !active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5',
              'text-[0.8rem] transition-all duration-200 ease-editorial',
              active
                ? 'border-accent bg-accent text-canvas shadow-paper'
                : 'border-line bg-surface-raised text-ink-soft hover:border-line-strong hover:text-ink',
              // An empty filter stays visible so the set of types does not jump,
              // but it is not offered as a click target.
              count === 0 && !active && 'cursor-not-allowed opacity-50',
            )}
          >
            {Icon ? (
              <Icon
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn('size-3.5', active ? 'text-canvas/80' : 'text-ink-faint')}
              />
            ) : null}
            {filter.label}
            <span
              className={cn(
                'tabular text-[0.72rem]',
                active ? 'text-canvas/75' : 'text-ink-faint',
              )}
            >
              {formatNumber(count)}
            </span>
          </button>
        )
      })}
    </div>
  )
}