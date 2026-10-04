import { BookOpen, Image as ImageIcon, Pencil, Quote as QuoteIcon, Trash2, Type } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { LtrText } from '@/components/common/LtrText'
import { useStoredImage } from '@/hooks/useStoredImage'
import { cn } from '@/lib/cn'
import { formatJalaliDateOrNull } from '@/lib/date'
import { formatNumber, toPersianDigits } from '@/lib/format'
import { NOTE_TYPE_META, type Note, type NoteType } from '@/types/note'
import type { Book } from '@/types/book'

const TYPE_ICONS: Record<NoteType, typeof Type> = {
  text: Type,
  quote: QuoteIcon,
  image: ImageIcon,
}

export interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
  /**
   * The owning book, when the note is shown outside its own book page (the
   * Notes library). `null` means the book is missing or deleted, which is
   * rendered as a quiet note rather than a dead link.
   */
  book?: Book | null
  /** Opens the owning book. Omit to hide the action entirely. */
  onOpenBook?: (bookId: string) => void
  /** Preview context in the library: clamp long bodies to keep the list scannable. */
  compact?: boolean
  /**
   * Marks the entry as the one the user navigated to, so arriving from the
   * Notes library shows a quiet ring rather than silently scrolling past it.
   */
  highlighted?: boolean
}

/**
 * One journal entry.
 *
 * Quotes are set apart with the serif face and a margin rule so they read as
 * something lifted *from* the book, while notes stay in the body face. Page
 * references are deliberately quiet — a small folio marker, never a badge.
 *
 * The same component serves the per-book journal and the cross-book library; the
 * book context and its "open" action simply go away when not supplied, so
 * there is only one presentation of a note in the app.
 */
export function NoteCard({
  note,
  onEdit,
  onDelete,
  book,
  onOpenBook,
  compact = false,
  highlighted = false,
}: NoteCardProps) {
  const { url: imageUrl, missing } = useStoredImage(note.imageRef)
  const isQuote = note.type === 'quote'
  const Icon = TYPE_ICONS[note.type]
  const ref = useRef<HTMLElement>(null)
  const createdLabel = formatJalaliDateOrNull(note.createdAt)

  // Bring the entry the user asked for into view. `nearest` avoids yanking the
  // page when it is already visible, and focus moves so keyboard users land on
  // it too.
  useEffect(() => {
    if (!highlighted) return
    ref.current?.scrollIntoView({ block: 'nearest' })
    ref.current?.focus({ preventScroll: true })
  }, [highlighted])

  return (
    <article
      ref={ref}
      tabIndex={highlighted ? -1 : undefined}
      aria-current={highlighted ? 'true' : undefined}
      data-testid="journal-note"
      data-note-type={note.type}
      className={cn(
        'group relative rounded-lg border bg-surface-raised p-4',
        'transition-colors duration-200 ease-editorial hover:border-line-strong',
        isQuote ? 'border-line-soft bg-accent-wash/25' : 'border-line-soft',
        highlighted && 'border-accent ring-1 ring-accent/40',
      )}
    >
      {/* A soft rule marks quotes as text lifted from the book. */}
      {isQuote ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-4 start-0 w-0.5 rounded-full bg-accent/50"
        />
      ) : null}

      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[0.72rem]',
            isQuote ? 'text-accent' : 'text-ink-soft',
          )}
        >
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          {NOTE_TYPE_META[note.type].label}
        </span>

        {note.page ? (
          <span className="tabular text-[0.7rem] text-ink-faint">
            صفحهٔ {formatNumber(note.page)}
          </span>
        ) : null}

        {/* An unparseable timestamp hides the element instead of printing a blank or
            throwing — a malformed record must not break the whole list. */}
        {createdLabel ? (
          <time dateTime={note.createdAt} className="text-[0.7rem] text-ink-faint">
            {createdLabel}
          </time>
        ) : null}

        {note.updatedAt ? (
          <span className="text-[0.68rem] text-ink-faint/80">
            · ویرایش‌شده
          </span>
        ) : null}
        {/* Actions stay reachable by keyboard at all times. */}
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label={
              note.page
                ? `ویرایش یادداشت صفحهٔ ${toPersianDigits(note.page)}`
                : 'ویرایش یادداشت'
            }
            className="flex size-7 items-center justify-center rounded-xs text-ink-faint transition-colors duration-200 hover:bg-surface hover:text-ink"
          >
            <Pencil aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            aria-label="حذف یادداشت"
            className="flex size-7 items-center justify-center rounded-xs text-ink-faint transition-colors duration-200 hover:bg-surface hover:text-status-dropped"
          >
            <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          </button>
        </div>
      </header>

      {note.type === 'image' ? (
        <div className="mt-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={note.content || 'تصویر یادداشت'}
              loading="lazy"
              // A list preview stays short; the book page shows the full frame.
              className={cn(
                'w-full rounded-md border border-line-soft object-cover',
                compact ? 'max-h-44' : 'max-h-80',
              )}
            />
          ) : (
            <p className="rounded-md border border-dashed border-line bg-surface/50 px-3 py-4 text-center text-[0.75rem] text-ink-faint">
              {missing ? 'تصویر دیگر در دسترس نیست.' : 'در حال بارگذاری تصویر…'}
            </p>
          )}
        </div>
      ) : null}

      {/* Book context — only meaningful outside the book's own journal page. */}
      {book !== undefined ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line-soft pt-2.5 text-[0.7rem]">
          {book ? (
            <>
              {/* `min-w-0` lets the title truncate instead of pushing the action
                  out of the row; `basis-full` on small screens would stack them,
                  so flex-wrap plus a shrinkable title is enough. */}
              <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                <BookOpen
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-3.5 shrink-0"
                />
                <LtrText className="min-w-0 truncate">{book.title}</LtrText>
                <span aria-hidden="true" className="shrink-0 text-ink-faint">
                  —
                </span>
                <LtrText className="min-w-0 truncate text-ink-faint">
                  {book.author}
                </LtrText>
              </span>

              {onOpenBook ? (
                <button
                  type="button"
                  data-testid={`note-open-book-${note.id}`}
                  onClick={() => onOpenBook(book.id)}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-strong hover:underline"
                >
                  دیدن در دفتر کتاب
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-ink-faint">
              این کتاب دیگر در کتابخانه نیست، پس یادداشت بدون کتاب باقی مانده است.
            </span>
          )}
        </div>
      ) : null}

      {note.content ? (
        <p
          // `dir="auto"` lets the browser infer direction from the first strong
          // character, so English notes read left-to-right and Persian notes
          // right-to-left without the trailing punctuation jumping the wrong way.
          dir="auto"
          className={cn(
            'mt-3 text-[0.9rem] leading-[2] text-ink',
            // In the library list a long entry is clamped; the full text is one
            // click away on the book page, so nothing is silently discarded.
            compact && 'line-clamp-4',
            isQuote &&
              'border-s-2 border-accent/40 ps-3 font-serif text-[1rem] leading-[2.1] text-ink/90',
          )}
        >
          {note.content}
        </p>
      ) : null}
    </article>
  )
}