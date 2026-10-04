import { LtrText } from '@/components/common/LtrText'
import { ProgressBar } from '@/components/common/ProgressBar'
import { formatNumber, formatPercent } from '@/lib/format'
import type { ProgressInsight } from '@/lib/stats'

export interface ProgressOverviewProps {
  insight: ProgressInsight
  onOpenBook: (id: string) => void
}

/**
 * Progress for the books currently being read.
 *
 * Only books with a recorded progress value appear. Books marked as reading
 * whose progress was never recorded are named separately, so an unrecorded
 * book is never silently rendered as a 0% bar.
 */
export function ProgressOverview({ insight, onOpenBook }: ProgressOverviewProps) {
  const { rows, booksWithoutProgress, averageProgress, booksWithPageData } = insight
  const hasRows = rows.length > 0

  return (
    <section aria-labelledby="progress-overview" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h2 id="progress-overview" className="text-sm font-semibold text-ink">
            پیشرفت کتاب‌های در جریان
          </h2>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-soft">
            درصد پیشرفتی که خودتان برای هر کتاب ثبت کرده‌اید.
          </p>
        </div>

        {averageProgress !== null ? (
          <p className="text-[0.72rem] text-ink-soft">
            میانگین{' '}
            <span className="tabular font-medium text-ink">
              {formatPercent(averageProgress)}
            </span>{' '}
            میان {formatNumber(rows.length)} کتاب
          </p>
        ) : null}
      </div>

      {!hasRows ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-[0.82rem] leading-[2] text-ink-soft">
          هیچ کتابی در وضعیت «در حال خواندن» با پیشرفت ثبت‌شده نیست. اگر در صفحهٔ
          یک کتاب درصد پیشرفت را وارد کنید، اینجا نمایش داده می‌شود.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ book, progress, currentPage, totalPages }) => (
            <li key={book.id}>
              <div className="rounded-lg border border-line-soft bg-surface-raised p-4 shadow-paper">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <button
                    type="button"
                    data-testid={`progress-open-${book.id}`}
                    onClick={() => onOpenBook(book.id)}
                    className="min-w-0 text-start transition-opacity duration-200 hover:opacity-80"
                  >
                    <LtrText
                      as="h3"
                      className="truncate font-serif text-[0.95rem] font-medium text-ink"
                    >
                      {book.title}
                    </LtrText>
                    <LtrText className="block truncate text-[0.72rem] text-ink-soft">
                      {book.author}
                    </LtrText>
                  </button>

                  <div className="tabular shrink-0 text-end">
                    <p className="text-[0.85rem] font-medium text-ink">
                      {formatPercent(progress)}
                    </p>
                    {currentPage !== null && totalPages !== null ? (
                      <p className="text-[0.68rem] text-ink-faint">
                        صفحهٔ {formatNumber(currentPage)} از {formatNumber(totalPages)}
                      </p>
                    ) : (
                      // No page count on file — say so instead of omitting it.
                      <p className="text-[0.68rem] text-ink-faint">
                        شمار صفحه ثبت نشده
                      </p>
                    )}
                  </div>
                </div>

                <ProgressBar
                  value={progress}
                  label={`پیشرفت خواندن ${book.title}: ${formatPercent(progress)}`}
                  className="mt-3"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(booksWithoutProgress > 0 || booksWithPageData < rows.length) && hasRows ? (
        <p className="text-[0.7rem] leading-relaxed text-ink-faint">
          {booksWithoutProgress > 0
            ? `${formatNumber(booksWithoutProgress)} کتاب در حال خواندن هستند که هنوز درصدی برایشان ثبت نشده، پس در این میانگین نیامده‌اند. `
            : ''}
          {formatNumber(rows.length - booksWithPageData)} کتاب شمار صفحه ندارند، بنابراین
          تنها درصد پیشرفتشان نمایش داده می‌شود.
        </p>
      ) : null}
    </section>
  )
}