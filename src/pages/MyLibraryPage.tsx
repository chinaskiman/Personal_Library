import { useMemo, useState } from 'react'
import { Library as LibraryIcon, SearchX, BookPlus } from 'lucide-react'

import { BookCard } from '@/components/books/BookCard'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/common/buttonStyles'
import { AddBookButton } from '@/components/common/AddBookButton'
import { EmptyState } from '@/components/common/EmptyState'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { SortControl } from '@/components/library/SortControl'
import {
  StatusFilterBar,
  type LibraryFilter,
} from '@/components/library/StatusFilterBar'
import { READING_STATUS_META } from '@/data/readingStatus'
import {
  bookMatchesQuery,
  sortBooks,
  type LibrarySort,
} from '@/lib/library'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Book, ReadingStatus } from '@/types/book'

export interface MyLibraryPageProps {
  books: Book[]
  counts: Record<ReadingStatus, number> & { total: number }
  /** Shared with the top bar and the dashboard — one search state, not two. */
  searchValue: string
  onSearchChange: (value: string) => void
  onAddBook: () => void
  /** Opens the book detail view for a given id. */
  onOpenBook: (id: string) => void
}

export function MyLibraryPage({
  books,
  counts,
  searchValue,
  onSearchChange,
  onAddBook,
  onOpenBook,
}: MyLibraryPageProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [sort, setSort] = useState<LibrarySort>('recently-added')

  // Filtering and searching first, then sorting — they compose in one pass.
  const visible = useMemo(() => {
    const byStatus =
      filter === 'all' ? books : books.filter((book) => book.status === filter)

    return sortBooks(
      byStatus.filter((book) => bookMatchesQuery(book, searchValue)),
      sort,
    )
  }, [books, filter, searchValue, sort])

  const hasQuery = searchValue.trim().length > 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="max-w-2xl">
          <p className="text-[0.72rem] tracking-[0.16em] text-ink-faint uppercase">
            قفسهٔ من
          </p>
          <h1 className="mt-2.5 text-3xl font-semibold text-ink sm:text-4xl">
            کتابخانه من
          </h1>
          <p className="mt-4 text-[0.95rem] leading-[2] text-ink-soft">
            همهٔ کتاب‌هایی که روی قفسه گذاشته‌اید، در هر سه وضعیت. اینجا می‌توانید
            میان آن‌ها بگردید، مرتب کنید و هر زمان خواستید کتابی تازه به مجموعه
            اضافه کنید.
          </p>
          <p className="tabular mt-4 text-sm text-ink-faint">
            {formatNumber(counts.total)} کتاب در کتابخانه ·{' '}
            {formatNumber(counts.reading)} در حال مطالعه ·{' '}
            {formatNumber(counts['want-to-read'])} در فهرست انتظار
          </p>
        </div>

        <AddBookButton onClick={onAddBook} />
      </header>

      {/* Toolbar: search, filters, sorting. */}
      <section className="space-y-4">
        <GlobalSearch
          value={searchValue}
          onChange={onSearchChange}
          placeholder="جست‌وجو در کتابخانه — عنوان یا نویسنده…"
          size="xl"
        />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <StatusFilterBar value={filter} onChange={setFilter} counts={counts} />
          <SortControl value={sort} onChange={setSort} />
        </div>
      </section>

      <section aria-label="نتایج کتابخانه">
        {visible.length > 0 ? (
          <>
            <p className="sr-only" aria-live="polite">
              {formatNumber(visible.length)} کتاب نمایش داده می‌شود.
            </p>
            {/* Covers lead at every width; the ratio is fixed by BookCard. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((book) => (
                <LibraryBookCard
                  key={book.id}
                  book={book}
                  onOpen={() => onOpenBook(book.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyLibraryState
            filter={filter}
            hasQuery={hasQuery}
            searchValue={searchValue}
            onClearSearch={() => onSearchChange('')}
            onAddBook={onAddBook}
            onResetFilter={() => setFilter('all')}
          />
        )}
      </section>
    </div>
  )
}

/**
 * Shelf card.
 *
 * Wraps the shared `BookCard` in a button to give the grid a real keyboard
 * affordance for the book-detail page that arrives in a later phase. The
 * button is stretched over the card so the whole tile is clickable while
 * keeping a single, correctly-labelled tab stop per book.
 */
function LibraryBookCard({
  book,
  onOpen,
}: {
  book: Book
  onOpen: () => void
}) {
  return (
    <div className="relative">
      <BookCard book={book} headingLevel={2} />
      <button
        type="button"
        onClick={onOpen}
        data-testid={`open-book-${book.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        aria-label={`مشاهدهٔ ${book.title} — ${book.author}`}
      >
        <span className="sr-only">مشاهدهٔ جزئیات کتاب</span>
      </button>
    </div>
  )
}
/** One warm, editorial message per empty situation. */
function EmptyLibraryState({
  filter,
  hasQuery,
  searchValue,
  onClearSearch,
  onAddBook,
  onResetFilter,
}: {
  filter: LibraryFilter
  hasQuery: boolean
  searchValue: string
  onClearSearch: () => void
  onAddBook: () => void
  onResetFilter: () => void
}) {
  // Search narrows everything — that is the most likely reason for zero rows.
  if (hasQuery) {
    return (
      <EmptyState headingLevel={2}
        icon={SearchX}
        title="کتابی با این جست‌وجو پیدا نشد"
        description={`هیچ کتابی با «${searchValue.trim()}» در این مجموعه نیست. املای دیگری را امتحان کنید یا نام نویسنده را بنویسید.`}
        action={
          <button
            type="button"
            onClick={onClearSearch}
            className={cn('mt-5', SECONDARY_BUTTON)}
          >
            پاک کردن جست‌وجو
          </button>
        }
      />
    )
  }

  if (filter === 'all') {
    return (
      <EmptyState headingLevel={2}
        icon={LibraryIcon}
        title="قفسه هنوز خالی است"
        description="هنوز کتابی به کتابخانه اضافه نکرده‌اید. با افزودن نخستین کتاب، این قفسه جان می‌گیرد."
        action={
          <button
            type="button"
            onClick={onAddBook}
            className={cn('mt-5', PRIMARY_BUTTON)}
          >
            <BookPlus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            افزودن کتاب
          </button>
        }
      />
    )
  }

  const meta = READING_STATUS_META[filter as ReadingStatus]

  return (
    <EmptyState headingLevel={2}
      icon={LibraryIcon}
      title="در این وضعیت کتابی ندارید"
      description={`هنوز کتابی با وضعیت «${meta.label}» ثبت نکرده‌اید. ${meta.hint}`}
      action={
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onAddBook}
            className={PRIMARY_BUTTON}
          >
            <BookPlus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            افزودن کتاب
          </button>
          <button
            type="button"
            onClick={onResetFilter}
            className={SECONDARY_BUTTON}
          >
            دیدن همهٔ کتاب‌ها
          </button>
        </div>
      }
    />
  )
}