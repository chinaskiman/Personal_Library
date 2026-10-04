import { READING_STATUS_META, READING_STATUS_ORDER } from '@/data/readingStatus'
import { formatNumber, toPersianDigits } from '@/lib/format'
import type { ReadingStatus } from '@/types/book'

export interface StatusDistributionProps {
  counts: Record<ReadingStatus, number>
  total: number
}

/**
 * How the library splits across reading statuses.
 *
 * A horizontal rule per status rather than a pie: every row carries its own
 * visible label and count, so the chart is fully readable without relying on
 * colour or on matching a segment to a legend. The bars fill from the
 * inline-start edge, which keeps the direction correct in RTL.
 */
export function StatusDistribution({ counts, total }: StatusDistributionProps) {
  const summary = READING_STATUS_ORDER.filter((status) => counts[status] > 0)
    .map((status) => `${READING_STATUS_META[status].label}: ${toPersianDigits(counts[status])}`)
    .join('، ')

  return (
    <section
      aria-labelledby="status-distribution"
      className="rounded-lg border border-line-soft bg-surface-raised p-5 shadow-paper"
    >
      <header>
        <h2 id="status-distribution" className="text-sm font-semibold text-ink">
          توزیع وضعیت کتاب‌ها
        </h2>
        <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-soft">
          شمار کتاب‌ها در هر وضعیت، از روی مجموعهٔ فعلی کتابخانه.
        </p>
      </header>

      {total === 0 ? (
        <p className="mt-4 text-[0.8rem] leading-relaxed text-ink-faint">
          هنوز کتابی در کتابخانه نیست تا توزیع وضعیت‌ها نشان داده شود.
        </p>
      ) : (
        <>
          {/* The bars are decorative; this sentence carries the same data to
              assistive tech, so the chart is never colour-only. */}
          <p className="sr-only">مجموع {toPersianDigits(total)} کتاب — {summary}</p>

          <ul className="mt-4 space-y-3">
            {READING_STATUS_ORDER.map((status) => {
              const meta = READING_STATUS_META[status]
              const count = counts[status]
              const percent = total > 0 ? (count / total) * 100 : 0

              return (
                <li key={status}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[0.78rem] text-ink">
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-full ${meta.dotClassName}`}
                      />
                      {meta.label}
                    </span>
                    <span className="tabular shrink-0 text-[0.75rem] text-ink-soft">
                      {formatNumber(count)}
                      <span className="ms-1.5 text-ink-faint">
                        ({toPersianDigits(Math.round(percent))}٪)
                      </span>
                    </span>
                  </div>

                  <div
                    aria-hidden="true"
                    className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
                  >
                    <div
                      className={`h-full rounded-full ${meta.dotClassName}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}