import { useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Hash,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { BookCover } from '@/components/books/BookCover'
import { EditBookDialog } from '@/components/book/EditBookDialog'
import { SECONDARY_BUTTON } from '@/components/common/buttonStyles'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { JournalSection } from '@/components/journal/JournalSection'
import { ProgressBar } from '@/components/common/ProgressBar'
import { ReadingStatusSelect } from '@/components/add-book/ReadingStatusSelect'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LtrText } from '@/components/common/LtrText'
import { READING_STATUS_META } from '@/data/readingStatus'
import { formatJalaliDateOrNull } from '@/lib/date'
import { formatNumber, formatPercent } from '@/lib/format'
import type { Book, EditBookInput, ReadingStatus } from '@/types/book'
import type { Note } from '@/types/note'

export interface BookDetailsPageProps {
  book: Book
  notes: Note[]
  onBack: () => void
  onUpdateBook: (id: string, patch: EditBookInput) => void
  onSetStatus: (id: string, status: ReadingStatus, progressPercent?: number) => void
  onDeleteBook: (id: string) => void
  onCreateNote: (
    bookId: string,
    draft: Omit<Note, 'id' | 'bookId' | 'createdAt'>,
  ) => void
  onUpdateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'bookId'>>) => void
  onDeleteNote: (id: string) => void
  /** Note to reveal on arrival, set when coming from the Notes library. */
  focusNoteId?: string | null
}

/**
 * A single book, its reading state, and its journal.
 *
 * Laid out as a two-column spread on wide screens — cover and facts on the
 * start side, journal on the end — collapsing to one column so the reading
 * measure stays comfortable at every width.
 */
export function BookDetailsPage({
  book,
  notes,
  onBack,
  onUpdateBook,
  onSetStatus,
  onDeleteBook,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  focusNoteId = null,
}: BookDetailsPageProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = READING_STATUS_META[book.status]
  const isReading = book.status === 'reading'
  const percent = Math.round(Math.min(Math.max(book.progress, 0), 1) * 100)
  const canDelete = book.origin === 'user'

  return (
    <div className="space-y-10">
      {/* Back navigation — first thing in the reading order. */}
      <button
        type="button"
        data-testid="back-to-library"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[0.82rem] text-ink-soft transition-colors duration-200 hover:text-accent"
      >
        <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
        بازگشت به کتابخانه
      </button>
<div className="grid gap-10 lg:grid-cols-[19rem_1fr] lg:gap-12">
        {/* ---------------- left column: the book itself ---------------- */}
        <div className="space-y-6">
          {/* `size="lg"` typography needs the same portrait ratio the grid uses,
              otherwise the cover letterboxes into an unhelpful landscape shape. */}
          <BookCover
            seed={book.id}
            title={book.title}
            src={book.coverImage}
            alt={`جلد ${book.title}`}
            size="lg"
            className="mx-auto aspect-[3/4.4] w-40 sm:w-48 lg:mx-0 lg:w-full"
          />

          <div className="space-y-2 text-center lg:text-start">
            <StatusBadge
              label={status.label}
              dotClassName={status.dotClassName}
              className={status.className}
              size="md"
            />
            <LtrText
              as="h1"
              className="mt-2 block font-serif text-2xl leading-snug font-semibold text-ink"
            >
              {book.title}
            </LtrText>
            {book.translatedTitle ? (
              <p className="text-sm text-ink-faint">{book.translatedTitle}</p>
            ) : null}
            <LtrText className="block text-[0.95rem] text-ink-soft">
              {book.author}
            </LtrText>
          </div>

          {book.status !== 'want-to-read' ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.78rem] font-medium text-ink">
                  پیشرفت خواندن
                </span>
                <span className="tabular text-[0.78rem] text-ink-soft">
                  {formatPercent(book.progress)}
                </span>
              </div>
              <ProgressBar
                value={book.progress}
                label={`پیشرفت خواندن ${book.title}`}
              />
              {book.currentPage && book.totalPages ? (
                <p className="tabular text-[0.72rem] text-ink-faint">
                  صفحهٔ {formatNumber(book.currentPage)} از{' '}
                  {formatNumber(book.totalPages)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Facts — a row only renders when the value is actually known. */}
          <dl className="space-y-2.5 border-t border-line-soft pt-4 text-[0.82rem]">
            {book.publishedYear ? (
              <FactRow icon={CalendarDays} label="سال انتشار">
                <span className="tabular">
                  {formatNumber(book.publishedYear)}
                </span>
              </FactRow>
            ) : null}

            {book.totalPages ? (
              <FactRow icon={Layers} label="تعداد صفحات">
                <span className="tabular">{formatNumber(book.totalPages)}</span>
              </FactRow>
            ) : null}

            {book.genre ? (
              <FactRow icon={Hash} label="ژانر">
                <span>{book.genre}</span>
              </FactRow>
            ) : null}

            {book.isbn ? (
              <FactRow icon={Hash} label="ISBN">
                <LtrText className="tabular">{book.isbn}</LtrText>
              </FactRow>
            ) : null}
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
            <button
              type="button"
              data-testid="edit-book"
              onClick={() => setEditing(true)}
              className={SECONDARY_BUTTON}
            >
              <Pencil aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
              ویرایش اطلاعات
            </button>

            {canDelete ? (
              <button
                type="button"
                data-testid="delete-book"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface-raised px-3.5 text-[0.8rem] text-ink-soft transition-colors duration-200 hover:border-status-dropped/50 hover:text-status-dropped"
              >
                <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                حذف کتاب
              </button>
            ) : (
              <span className="text-[0.7rem] text-ink-faint">
                این کتاب بخشی از داده‌های نمایشی است
              </span>
            )}
          </div>
        </div>
{/* ---------------- right column: reading state + journal -------------- */}
        <div className="space-y-10">
          <section
            aria-labelledby="reading-state"
            className="space-y-4 rounded-lg border border-line-soft bg-surface/40 p-5"
          >
            <div>
              <h2 id="reading-state" className="text-base font-semibold text-ink">
                وضعیت مطالعه
              </h2>
              <p className="mt-1 text-[0.78rem] text-ink-soft">{status.hint}</p>
            </div>

            <ReadingStatusSelect
              value={book.status}
              onChange={(next) => onSetStatus(book.id, next)}
              progressPercent={isReading && percent > 0 ? String(percent) : ''}
              onProgressChange={(value) =>
                onSetStatus(book.id, 'reading', Number(value) || 0)
              }
            />

            {/* A corrupt or missing completion date shows nothing rather than breaking
                the page inside `Intl`. */}
            {formatJalaliDateOrNull(book.finishedAt) ? (
              <p className="tabular text-[0.72rem] text-ink-faint">
                به پایان رسیده در {formatJalaliDateOrNull(book.finishedAt)}
              </p>
            ) : null}
          </section>

          <JournalSection
            bookId={book.id}
            notes={notes}
            focusNoteId={focusNoteId}
            onCreate={(draft) => onCreateNote(book.id, draft)}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />
        </div>
      </div>

      <EditBookDialog
        open={editing}
        book={book}
        onClose={() => setEditing(false)}
        onSave={(patch) => onUpdateBook(book.id, patch)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="حذف کتاب"
        description={`«${book.title}» و همهٔ یادداشت‌های دفتر خواندنش برای همیشه حذف می‌شوند.`}
        confirmLabel="حذف کتاب و یادداشت‌ها"
        destructive
        onConfirm={() => {
          onDeleteBook(book.id)
          setConfirmDelete(false)
          onBack()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

/** One label/value row in the facts list. */
function FactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Hash
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="flex shrink-0 items-center gap-1.5 text-ink-faint">
        <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-end text-ink-soft">
        {children}
      </dd>
    </div>
  )
}