import { BookOpen, X } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import type { Book } from '@/types/book'

export interface BookFilterSelectProps {
  /** Books that actually own at least one note. */
  books: readonly Book[]
  /** Selected book id, or `null` for all books. */
  value: string | null
  onChange: (bookId: string | null) => void
  /** Notes per book, so the option list can show volumes. */
  counts: ReadonlyMap<string, number>
}

/**
 * Book filter.
 *
 * A native `<select>` keyed on stable book ids, never on titles — two editions
 * with the same title must remain independently selectable. Only books that
 * actually hold notes are listed, which keeps the control short as the library
 * grows and makes an empty result explainable ("no notes in this book").
 */
export function BookFilterSelect({
  books,
  value,
  onChange,
  counts,
}: BookFilterSelectProps) {
  const selected = books.find((book) => book.id === value) ?? null

  // A filter pointing at a deleted book must not strand the user with an
  // invisible, un-clearable constraint.
  const hasStaleValue = value !== null && selected === null

  return (
    <div className="flex items-center gap-2">
      <BookOpen
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-4 shrink-0 text-ink-faint"
      />
      <label htmlFor="note-book-filter" className="sr-only">
        فیلتر بر اساس کتاب
      </label>
      <select
        id="note-book-filter"
        value={hasStaleValue ? '' : (value ?? '')}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 max-w-[16rem] cursor-pointer truncate rounded-md border border-line bg-surface-raised ps-3 pe-8 text-[0.8rem] text-ink transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      >
        <option value="">همهٔ کتاب‌ها</option>
        {hasStaleValue ? (
          <option value="" disabled>
            کتاب انتخابی دیگر موجود نیست
          </option>
        ) : null}
        {books.map((book) => (
          <option key={book.id} value={book.id}>
            {book.title} ({formatNumber(counts.get(book.id) ?? 0)})
          </option>
        ))}
      </select>

      {selected ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          data-testid="clear-book-filter"
          className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-surface-raised px-2.5 text-[0.75rem] text-ink-soft transition-colors duration-200 hover:border-accent hover:bg-accent-wash hover:text-ink"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
          حذف فیلتر کتاب
        </button>
      ) : null}
    </div>
  )
}

export interface PageRefFilterSelectProps {
  value: 'any' | 'with' | 'without'
  onChange: (value: 'any' | 'with' | 'without') => void
}

const PAGE_OPTIONS = [
  { id: 'any', label: 'با یا بدون شمارهٔ صفحه' },
  { id: 'with', label: 'فقط یادداشت‌های صفحه‌دار' },
  { id: 'without', label: 'فقط یادداشت‌های بی‌شمارهٔ صفحه' },
] as const

/**
 * Page-reference filter.
 *
 * Not every note carries a page, so the default is deliberately "any" rather
 * than hiding the notes that lack one.
 */
export function PageRefFilterSelect({
  value,
  onChange,
}: PageRefFilterSelectProps) {
  return (
    <>
      <label htmlFor="note-page-filter" className="sr-only">
        فیلتر بر اساس شمارهٔ صفحه
      </label>
      <select
        id="note-page-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as 'any' | 'with' | 'without')}
        className="h-9 cursor-pointer rounded-md border border-line bg-surface-raised ps-3 pe-8 text-[0.8rem] text-ink transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      >
        {PAGE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  )
}