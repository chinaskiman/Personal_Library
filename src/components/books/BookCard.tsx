import { BookCover } from '@/components/books/BookCover'
import { LtrText } from '@/components/common/LtrText'
import { ProgressBar } from '@/components/common/ProgressBar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { READING_STATUS_META } from '@/data/readingStatus'
import { formatRelativeDate } from '@/lib/date'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Book } from '@/types/book'

export interface BookCardProps {
  book: Book
  /** `default` = shelf grid, `featured` = larger "currently reading" card. */
  variant?: 'default' | 'featured'
  /**
   * Heading level for the title.
   *
   * The card is used in two different outlines: on the dashboard each card sits
   * under a section `h2`, so the title is an `h3`; on the library page the grid
   * follows the page `h1` directly, where an `h3` would skip a level. Callers
   * declare which outline they are in rather than the card guessing.
   */
  headingLevel?: 2 | 3
  className?: string
}

/**
 * A single book in the shelf.
 * English title and author are rendered inside an LTR isolate.
 */
export function BookCard({
  book,
  variant = 'default',
  headingLevel = 3,
  className,
}: BookCardProps) {
  const status = READING_STATUS_META[book.status]
  const isFeatured = variant === 'featured'

  return (
    <article
      className={cn(
        'group flex rounded-lg border border-line-soft bg-surface-raised shadow-paper',
        'transition-all duration-300 ease-editorial',
        'hover:-translate-y-0.5 hover:border-line hover:shadow-soft',
        isFeatured ? 'flex-row gap-5 p-4' : 'flex-col gap-3.5 p-3.5',
        className,
      )}
    >
      <BookCover
        seed={book.id}
        title={book.title}
        src={book.coverImage}
        alt={`جلد کتاب ${book.title}`}
        size={isFeatured ? 'lg' : 'sm'}
        className={cn(
          'shrink-0',
          isFeatured
            ? 'h-36 w-24 sm:h-40 sm:w-[6.5rem]'
            : 'aspect-[3/4.4] w-full',
        )}
      />

      <div className={cn('min-w-0', isFeatured ? 'flex flex-1 flex-col' : '')}>
        <div className="flex-1">
          <LtrText
            as={headingLevel === 2 ? 'h2' : 'h3'}
            className={cn(
              'line-clamp-2 font-serif font-semibold text-ink',
              isFeatured
                ? 'text-lg leading-snug sm:text-xl'
                : 'text-[0.95rem] leading-snug',
            )}
            title={book.title}
          >
            {book.title}
          </LtrText>

          {book.translatedTitle ? (
            <p className="mt-1 truncate text-xs text-ink-faint">
              {book.translatedTitle}
            </p>
          ) : null}

          <LtrText
            className={cn(
              'mt-1.5 block truncate text-ink-soft',
              isFeatured ? 'text-sm' : 'text-xs',
            )}
            title={book.author}
          >
            {book.author}
          </LtrText>

          {/* ISBN is an LTR run inside Persian copy — the isolate keeps it clean. */}
          {isFeatured && book.isbn ? (
            <LtrText className="tabular mt-1 block text-[0.7rem] text-ink-faint">
              ISBN {book.isbn}
            </LtrText>
          ) : null}
        </div>

        <div className={cn(isFeatured ? 'mt-4 space-y-3' : 'mt-auto space-y-3 pt-1')}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={status.label}
              dotClassName={status.dotClassName}
              className={status.className}
            />
            {/* Bundled sample records are marked on the card itself, so a user
                can tell their own books apart from the shipped ones. */}
            {book.origin === 'demo' ? (
              <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[0.65rem] text-ink-faint">
                نمونه
              </span>
            ) : null}
            {!isFeatured && book.progress > 0 && book.progress < 1 ? (
              <span className="tabular text-[0.7rem] text-ink-faint">
                {formatPercent(book.progress)}
              </span>
            ) : null}
          </div>

          {book.progress > 0 && book.progress < 1 ? (
            <div className="space-y-1.5">
              <ProgressBar
                value={book.progress}
                label={`پیشرفت خواندن ${book.title}`}
              />
              {isFeatured && book.currentPage && book.totalPages ? (
                <p className="tabular text-[0.7rem] text-ink-faint">
                  صفحهٔ {formatNumber(book.currentPage)} از{' '}
                  {formatNumber(book.totalPages)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-2.5 text-[0.7rem] text-ink-faint">
            <span>{formatRelativeDate(book.lastAccessedAt)}</span>
            {book.noteCount ? (
              <span className="tabular">
                {formatNumber(book.noteCount)} یادداشت
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
