import { BookOpen, Image, Quote, TextQuote } from 'lucide-react'

import { LtrText } from '@/components/common/LtrText'
import { NOTE_TYPE_META } from '@/types/note'
import { formatRelativeDate } from '@/lib/date'
import type { ActivityEvent, RecentActivity } from '@/lib/stats'

export interface RecentActivityListProps {
  activity: RecentActivity
  onOpenBook: (id: string) => void
}

const NOTE_ICONS = {
  text: TextQuote,
  quote: Quote,
  image: Image,
} as const

/** Persian phrasing per event kind. */
function describe(event: ActivityEvent): string {
  const noteLabel = event.noteType ? NOTE_TYPE_META[event.noteType].label : 'یادداشت'

  switch (event.kind) {
    case 'note-created':
      return `${noteLabel} تازه نوشته شد`
    case 'note-updated':
      return `${noteLabel} ویرایش شد`
    case 'book-accessed':
      // Deliberately "باز شد", never "خواند": the app records an access, not a
      // reading session, and this must not imply time spent reading.
      return 'باز شد'
  }
}

/**
 * The most recent journal and access events.
 *
 * Each row links to its book through the same callback the library uses, so
 * navigation stays consistent. A note whose book was deleted renders without a
 * link rather than pointing nowhere.
 */
export function RecentActivityList({ activity, onOpenBook }: RecentActivityListProps) {
  // The bundled sample library has been removed, so every event reaching this
  // list came from something the user actually did.
  const realEvents = activity.events

  if (realEvents.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-[0.82rem] leading-[2] text-ink-soft">
          هنوز رویدادی از خودتان ثبت نشده است. با باز کردن یک کتابی که خودتان
          افزوده‌اید یا نوشتن نخستین یادداشت، فعالیت شما اینجا فهرست می‌شود.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft bg-surface-raised shadow-paper">
        {realEvents.map((event) => {
        const Icon =
          event.kind === 'book-accessed'
            ? BookOpen
            : NOTE_ICONS[event.noteType ?? 'text']
        // Empty when the timestamp is corrupt; the row then shows no date at
        // all rather than an invented one.
        const relativeLabel = formatRelativeDate(event.at.toISOString())

        return (
          <li key={event.id} data-testid={`activity-row-${event.id}`} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-canvas"
            >
              <Icon strokeWidth={1.5} className="size-3.5 text-accent" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] text-ink">
                {describe(event)}
                {event.book ? (
                  <>
                    {' — '}
                    <LtrText className="font-medium">{event.book.title}</LtrText>
                  </>
                ) : (
                  // The owning book is gone; keep the row, drop the link.
                  <span className="text-ink-faint"> — این کتاب دیگر در کتابخانه نیست</span>
                )}
              </p>

              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-ink-faint">
                {relativeLabel ? (
                  <span className="tabular">{relativeLabel}</span>
                ) : null}
                {event.book ? (
                  <button
                    type="button"
                    data-testid={`activity-open-${event.id}`}
                    onClick={() => onOpenBook(event.book?.id ?? '')}
                    className="text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-strong hover:underline"
                  >
                    دیدن کتاب
                  </button>
                ) : null}
              </p>
            </div>
          </li>
        )
      })}
      </ul>
    </div>
  )
}