import { ArrowDownWideNarrow } from 'lucide-react'

import { LIBRARY_SORT_OPTIONS, type LibrarySort } from '@/lib/library'
import { cn } from '@/lib/cn'

export interface SortControlProps {
  value: LibrarySort
  onChange: (sort: LibrarySort) => void
}

/**
 * Compact sort control.
 *
 * A native `<select>` is used deliberately: it is keyboard operable, exposes
 * correct RTL behaviour for the option list, and is announced properly by
 * screen readers — all without a custom listbox implementation.
 */
export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowDownWideNarrow
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-4 shrink-0 text-ink-faint"
      />
      <label htmlFor="library-sort" className="sr-only">
        ترتیب نمایش کتاب‌ها
      </label>
      <select
        id="library-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as LibrarySort)}
        className={cn(
          'h-9 cursor-pointer rounded-md border border-line bg-surface-raised',
          'ps-8 pe-3 text-[0.8rem] text-ink transition-colors duration-200',
          'hover:border-line-strong focus:border-accent focus:outline-none',
          'focus:ring-2 focus:ring-accent/25',
        )}
      >
        {LIBRARY_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}