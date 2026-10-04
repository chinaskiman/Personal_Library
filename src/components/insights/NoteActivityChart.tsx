import { ACTIVITY_WEEKS, type ActivityBucket } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { formatNumber, toPersianDigits } from '@/lib/format'

export interface NoteActivityChartProps {
  buckets: ActivityBucket[]
  /** Total notes inside the window — used only for the honest-data check. */
  totalNotes: number
}

/**
 * Journal entries written per Persian week.
 *
 * This counts notes the app actually recorded. It is explicitly *not* a
 * reading-volume chart: there is no session tracking in this app, so any
 * "pages read per week" figure would be invented. Every bar carries a visible
 * count and a Persian week label, and the whole series is repeated as a
 * sentence for assistive tech.
 *
 * Weeks with no entries render a flat baseline rather than disappearing, so an
 * empty week reads as "nothing written" instead of "no data".
 */
export function NoteActivityChart({ buckets, totalNotes }: NoteActivityChartProps) {
  const inWindow = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const peak = Math.max(...buckets.map((bucket) => bucket.count), 1)

  const summary = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => `هفتهٔ منتهی به ${bucket.label}: ${toPersianDigits(bucket.count)}`)
    .join('، ')

  return (
    <section
      aria-labelledby="note-activity"
      className="rounded-lg border border-line-soft bg-surface-raised p-5 shadow-paper"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="note-activity" className="text-sm font-semibold text-ink">
            یادداشت‌ها در گذر زمان
          </h2>
          <p className="mt-1 max-w-xl text-[0.72rem] leading-relaxed text-ink-soft">
            شمار یادداشت‌هایی که در هر هفتهٔ ایرانی نوشته‌اید، در{' '}
            {toPersianDigits(ACTIVITY_WEEKS)} هفتهٔ گذشته. این نمودار زمان
            مطالعه را نشان نمی‌دهد؛ برنامه زمان‌سنجی خواندن ندارد.
          </p>
        </div>
      </header>

      {totalNotes === 0 ? (
        <p className="mt-5 rounded-md border border-dashed border-line px-4 py-6 text-center text-[0.8rem] leading-[2] text-ink-soft">
          هنوز یادداشتی ننوشته‌اید. با نوشتن نخستین یادداشت در دفتر خواندن هر
          کتاب، این نمودار به‌تدریج شکل می‌گیرد.
        </p>
      ) : (
        <>
          <p className="sr-only">
            مجموع {toPersianDigits(inWindow)} یادداشت در بازهٔ{' '}
            {toPersianDigits(ACTIVITY_WEEKS)} هفتهٔ گذشته. {summary || 'همهٔ هفته‌ها خالی‌اند.'}
          </p>

          {/* `items-stretch` matters: each column must fill the track so the
              inner bar's `h-full` resolves against a real height. */}
          <div className="mt-5 flex h-32 items-stretch gap-1">
            {buckets.map((bucket) => {
              const ratio = bucket.count / peak
              const hasNotes = bucket.count > 0

              return (
                <div key={bucket.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className="tabular text-[0.6rem] text-ink-faint"
                    // The count stays visible so no bar relies on height alone.
                    aria-hidden="true"
                  >
                    {hasNotes ? toPersianDigits(bucket.count) : ''}
                  </span>

                  <div className="flex h-full min-h-0 w-full items-end justify-center">
                    {/* Capped width so a lone active week reads as a bar rather
                        than a large filled block. */}
                    <div
                      title={`هفتهٔ منتهی به ${bucket.label}: ${toPersianDigits(bucket.count)} یادداشت`}
                      className={cn(
                        'w-full max-w-[1.5rem] rounded-t-[2px]',
                        hasNotes ? 'bg-accent/60' : 'bg-surface-sunken',
                      )}
                      style={{ height: hasNotes ? `${Math.max(ratio * 100, 10)}%` : '3px' }}
                    />
                  </div>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[0.58rem] leading-tight text-ink-faint"
                  >
                    {bucket.label}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-[0.68rem] text-ink-faint">
            مجموع {formatNumber(inWindow)} یادداشت در این بازه
            {totalNotes > inWindow
              ? ` — ${formatNumber(totalNotes - inWindow)} یادداشت دیگر قدیمی‌تر از این بازه است.`
              : '.'}
          </p>
        </>
      )}
    </section>
  )
}