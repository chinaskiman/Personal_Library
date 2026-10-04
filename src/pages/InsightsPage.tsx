import { useMemo } from 'react'

import { SectionHeading } from '@/components/common/SectionHeading'
import { NoteActivityChart } from '@/components/insights/NoteActivityChart'
import { ProgressOverview } from '@/components/insights/ProgressOverview'
import { RecentActivityList } from '@/components/insights/RecentActivityList'
import { StatTile } from '@/components/insights/StatTile'
import { StatusDistribution } from '@/components/insights/StatusDistribution'
import { formatNumber, toPersianDigits } from '@/lib/format'
import {
  ACTIVITY_WEEKS,
  buildNoteActivity,
  buildRecentActivity,
  computeLibraryOverview,
  computeProgressInsight,
} from '@/lib/stats'
import type { Book } from '@/types/book'
import type { Note } from '@/types/note'

export interface InsightsPageProps {
  books: Book[]
  notes: Note[]
  onOpenBook: (id: string) => void
}

/**
 * Reading Insights — a reflective view of the library.
 *
 * Everything here is derived from live state via `lib/stats`; nothing is
 * hardcoded and no duplicate copy of the books or notes is kept. The tone is
 * deliberately descriptive: no streaks, goals, or comparisons, and no figure
 * that the data cannot honestly support.
 */
export function InsightsPage({ books, notes, onOpenBook }: InsightsPageProps) {
  // Read once per mount so every figure in a single view is computed against
  // the same instant rather than drifting between renders.
  const now = useMemo(() => new Date(), [])

  const overview = useMemo(() => computeLibraryOverview(books, notes), [books, notes])
  const progress = useMemo(() => computeProgressInsight(books), [books])
  const activity = useMemo(() => buildNoteActivity(notes, now), [notes, now])
  const recent = useMemo(
    // A generous limit: the list drops bundled sample access events after
    // sorting, so a small cap here could crowd out genuine ones.
    () => buildRecentActivity(books, notes, now, 60),
    [books, notes, now],
  )

  // Sample books' access dates used to be generated rather than recorded, so they
  // were summarised instead of being presented as real reading history. The
  // sample set has been removed, so every event below is genuine.
  const { byStatus, notesByType } = overview

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.72rem] tracking-[0.16em] text-ink-faint uppercase">
          دفتر مطالعه
        </p>
        <h1 className="mt-2.5 text-3xl font-semibold text-ink sm:text-4xl">
          بازتاب مطالعه
        </h1>
        <p className="mt-4 text-[0.95rem] leading-[2] text-ink-soft">
          تصویری آرام از کتابخانه و دفتر خواندنتان. اینجا آماری از چیزهایی می‌بینید که
          خودتان ثبت کرده‌اید — نه هدفی برای رسیدن، فقط مرور آنچه تا امروز نوشته
          شده است.
        </p>
      </header>

      <section aria-labelledby="library-overview" className="space-y-5">
        <SectionHeading
          eyebrow="نگاه کلی"
          title="کتابخانه در یک نگاه"
          description="شمار کتاب‌ها و یادداشت‌هایی که خودتان افزوده‌اید."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="همهٔ کتاب‌ها" value={formatNumber(overview.totalBooks)} />
          <StatTile label="خوانده‌شده" value={formatNumber(byStatus.finished)} />
          <StatTile label="در حال خواندن" value={formatNumber(byStatus.reading)} />
          <StatTile
            label="در فهرست مطالعه"
            value={formatNumber(byStatus['want-to-read'])}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="یادداشت‌های دفتر"
            value={formatNumber(overview.totalNotes)}
            hint="از روی یادداشت‌های واقعی"
          />
          <StatTile label="نقل‌قول" value={formatNumber(notesByType.quote)} />
          <StatTile label="یادداشت متنی" value={formatNumber(notesByType.text)} />
          <StatTile label="یادداشت تصویری" value={formatNumber(notesByType.image)} />
        </div>

        {/* The sample library has been removed, so every figure here is
            counted from records the user actually added. */}
        <p className="text-[0.72rem] leading-relaxed text-ink-faint">
          همهٔ این شمارش‌ها از کتاب‌ها و یادداشت‌هایی است که خودتان افزوده‌اید.
        </p>

        {overview.orphanedNotes > 0 ? (
          <p className="text-[0.7rem] leading-relaxed text-status-dropped">
            {formatNumber(overview.orphanedNotes)} یادداشت به کتابی اشاره می‌کند که
            دیگر در کتابخانه نیست؛ در شمارش یادداشت‌ها لحاظ نشده‌اند.
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <StatusDistribution counts={byStatus} total={overview.totalBooks} />

        <div className="rounded-lg border border-line-soft bg-surface-raised p-5 shadow-paper">
          <h2 className="text-sm font-semibold text-ink">نکته‌هایی دربارهٔ این آمار</h2>
          <ul className="mt-3 space-y-2.5 text-[0.75rem] leading-[2] text-ink-soft">
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-full bg-accent/60"
              />
              این برنامه زمان مطالعه را ثبت نمی‌کند، بنابراین هیچ نموداری از «صفحات
              خوانده» یا «مدت مطالعه» نشان نمی‌دهد.
            </li>
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-full bg-accent/60"
              />
              تاریخ «آخرین دسترسی» فقط نشان می‌دهد کتابی باز شده، نه اینکه چه مدت
              مطالعه شده است.
            </li>
            <li className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-full bg-accent/60"
              />
              هرجا داده‌ای ثبت نشده باشد، به‌جای عدد، نبودِ آن نوشته می‌شود.
            </li>
          </ul>
        </div>
      </div>

      <ProgressOverview insight={progress} onOpenBook={onOpenBook} />

      <div className="space-y-5">
        <SectionHeading
          eyebrow="گذر زمان"
          title="فعالیت اخیر"
          description={`آنچه در ${toPersianDigits(ACTIVITY_WEEKS)} هفتهٔ گذشته ثبت شده است.`}
        />
        <NoteActivityChart buckets={activity} totalNotes={overview.totalNotes} />
      </div>

      <section aria-labelledby="recent-events" className="space-y-4">
        <SectionHeading
          eyebrow="تازه‌ها"
          title="رویدادهای اخیر"
          description="رویدادهایی که برنامه واقعاً ثبت کرده است، از تازه به کهنه."
        />
        <div id="recent-events">
          <RecentActivityList activity={recent} onOpenBook={onOpenBook} />
        </div>
      </section>
    </div>
  )
}