import { useMemo, useState } from 'react'
import { BookPlus, Search } from 'lucide-react'

import { BookCover } from '@/components/books/BookCover'
import { EmptyState } from '@/components/common/EmptyState'
import { LtrText } from '@/components/common/LtrText'
import { DEMO_CATALOG, IS_DEMO_CATALOG } from '@/data/catalog'
import { READING_STATUS_META } from '@/data/readingStatus'
import { normalizeText } from '@/lib/library'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AddBookResult, NewBookInput } from '@/types/book'
import type { CatalogBook } from '@/types/catalog'

export interface BookSearchTabProps {
  /** Returns the add outcome so the dialog can report success or refusal. */
  onAdd: (input: NewBookInput) => AddBookResult
  /** True when the record is already in the library. */
  isInLibrary: (book: CatalogBook) => boolean
}

export function BookSearchTab({ onAdd, isInLibrary }: BookSearchTabProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const results = useMemo(() => {
    const needle = normalizeText(query)
    if (!needle) return DEMO_CATALOG
    return DEMO_CATALOG.filter((book) =>
      [book.title, book.author, book.isbn, book.genre].some((field) =>
        field ? normalizeText(field).includes(needle) : false,
      ),
    )
  }, [query])

  const selected = DEMO_CATALOG.find((book) => book.id === selectedId)

  /** Year and page count are only rendered when the source actually knows them. */
  const meta = (book: CatalogBook) =>
    [
      book.publishedYear ? formatNumber(book.publishedYear) : undefined,
      book.pageCount ? `${formatNumber(book.pageCount)} صفحه` : undefined,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="space-y-4">
      {IS_DEMO_CATALOG ? (
        <p className="rounded-lg border border-dashed border-line bg-surface/50 px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">نتایج نمایشی.</span>{' '}
          هنوز به هیچ سرویس کتابخانه‌ای وصل نشده‌ایم؛ این فهرست ثابت و فقط برای
          نمایش جریان کار است.
        </p>
      ) : null}

      <div className="relative">
        <label htmlFor="catalog-search" className="sr-only">
          جست‌وجوی کتاب بر اساس عنوان، نویسنده یا ISBN
        </label>
        <Search
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-ink-faint"
        />
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedId(null)
          }}
          placeholder="عنوان کتاب، نویسنده یا ISBN…"
          className="h-11 w-full rounded-md border border-line bg-surface-raised ps-10 pe-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 ease-editorial hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </div>

      {selected ? (
        <ReviewPanel
          book={selected}
          inLibrary={isInLibrary(selected)}
          onAdd={() => onAdd(toInput(selected))}
          onCancel={() => setSelectedId(null)}
        />
      ) : null}

      {!selected && results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="نتیجه‌ای پیدا نشد"
          description="عنوان یا نویسندهٔ دیگری را امتحان کنید، یا از زبانهٔ «ثبت دستی» کتاب را وارد کنید."
          className="py-12"
        />
      ) : null}
{!selected && results.length > 0 ? (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft bg-surface-raised">
          {results.map((book) => {
            const existing = isInLibrary(book)
            return (
              <li
                key={book.id}
                className="flex flex-wrap items-center gap-4 p-3.5 transition-colors duration-200 hover:bg-canvas-deep/50"
              >
                <BookCover
                  seed={book.id}
                  title={book.title}
                  src={book.coverImage}
                  alt={`جلد ${book.title}`}
                  className="h-20 w-14 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <LtrText
                    className="line-clamp-1 font-serif text-[0.95rem] font-semibold text-ink"
                    title={book.title}
                  >
                    {book.title}
                  </LtrText>
                  <LtrText className="mt-0.5 block truncate text-xs text-ink-soft">
                    {book.author}
                  </LtrText>
                  <div className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem] text-ink-faint">
                    {meta(book) ? <span>{meta(book)}</span> : null}
                    {book.isbn ? (
                      <LtrText className="tabular">{book.isbn}</LtrText>
                    ) : null}
                    {book.genre ? <span>{book.genre}</span> : null}
                  </div>
                </div>

                {existing ? (
                  <span
                    data-testid="already-in-library"
                    className="rounded-md border border-line bg-canvas px-2.5 py-1 text-[0.7rem] text-ink-faint"
                  >
                    در کتابخانه هست
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedId(book.id)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-canvas px-3 text-[0.78rem] font-medium text-ink transition-colors duration-200 hover:border-accent hover:bg-accent-wash"
                  >
                    <BookPlus aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                    افزودن
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/** Map a catalog record onto the add payload. */
function toInput(book: CatalogBook): NewBookInput {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publishedYear: book.publishedYear,
    totalPages: book.pageCount,
    genre: book.genre,
    status: 'want-to-read',
  }
}
/** Confirmation step shown before anything is actually added. */
function ReviewPanel({
  book,
  inLibrary,
  onAdd,
  onCancel,
}: {
  book: CatalogBook
  inLibrary: boolean
  onAdd: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border border-accent bg-accent-wash/40 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <BookCover
          seed={book.id}
          title={book.title}
          src={book.coverImage}
          alt={`جلد ${book.title}`}
          className="h-28 w-20 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-medium tracking-[0.16em] text-accent uppercase">
            مرور و تأیید
          </p>
          <LtrText className="mt-1 block font-serif text-lg font-semibold text-ink">
            {book.title}
          </LtrText>
          <LtrText className="mt-0.5 block text-sm text-ink-soft">
            {book.author}
          </LtrText>
          <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.72rem] text-ink-soft sm:grid-cols-3">
            {book.publishedYear ? (
              <div>
                <dt className="text-ink-faint">سال انتشار</dt>
                <dd>{formatNumber(book.publishedYear)}</dd>
              </div>
            ) : null}
            {book.pageCount ? (
              <div>
                <dt className="text-ink-faint">تعداد صفحات</dt>
                <dd>{formatNumber(book.pageCount)}</dd>
              </div>
            ) : null}
            {book.isbn ? (
              <div>
                <dt className="text-ink-faint">ISBN</dt>
                <dd>
                  <LtrText>{book.isbn}</LtrText>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-[0.72rem] text-ink-soft">
            وضعیت:{' '}
            <span className="text-ink">
              {READING_STATUS_META['want-to-read'].label}
            </span>{' '}
            — پس از افزودن می‌توانید آن را تغییر دهید.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={inLibrary}
          data-testid="review-confirm"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[0.8rem] font-medium',
            'transition-colors duration-200',
            inLibrary
              ? 'cursor-not-allowed border border-line bg-surface text-ink-faint'
              : 'border border-accent bg-accent text-canvas hover:bg-accent-strong',
          )}
        >
          <BookPlus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {inLibrary ? 'پیش‌تر افزوده شده' : 'افزودن به کتابخانه'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-line bg-canvas px-3.5 text-[0.8rem] text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          انصراف
        </button>
      </div>
    </div>
  )
}