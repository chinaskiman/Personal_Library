import { ArrowDownWideNarrow } from 'lucide-react'

import { NOTE_SORT_OPTIONS, type NoteSort } from '@/lib/notes'
import { cn } from '@/lib/cn'

export interface NoteSortControlProps {
  value: NoteSort
  onChange: (sort: NoteSort) => void
}

/**
 * Sort control for the notes list.
 *
 * A native `<select>` for the same reasons as the library's sort control: full
 * keyboard operation, correct RTL option ordering, and proper screen-reader
 * semantics without hand-rolling a listbox.
 */
export function NoteSortControl({ value, onChange }: NoteSortControlProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowDownWideNarrow
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-4 shrink-0 text-ink-faint"
      />
      <label htmlFor="note-sort" className="sr-only">
        ترتیب نمایش یادداشت‌ها
      </label>
      <select
        id="note-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as NoteSort)}
        className={cn(
          'h-9 cursor-pointer rounded-md border border-line bg-surface-raised',
          'ps-8 pe-3 text-[0.8rem] text-ink transition-colors duration-200',
          'hover:border-line-strong focus:border-accent focus:outline-none',
          'focus:ring-2 focus:ring-accent/25',
        )}
      >
        {NOTE_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}