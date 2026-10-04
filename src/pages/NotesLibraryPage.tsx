import { useMemo, useState } from 'react'
import { Library, NotebookPen, SearchX } from 'lucide-react'

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/common/buttonStyles'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { NoteCard } from '@/components/journal/NoteCard'
import { NoteSortControl } from '@/components/journal/NoteSortControl'
import { NoteTypeFilterBar } from '@/components/journal/NoteTypeFilterBar'
import {
  BookFilterSelect,
  PageRefFilterSelect,
} from '@/components/journal/NoteFilters'
import {
  booksWithNotes,
  selectNotes,
  type NoteSort,
  type NoteTypeFilter,
  type PageRefFilter,
} from '@/lib/notes'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Book } from '@/types/book'
import type { Note } from '@/types/note'

export interface NotesLibraryPageProps {
  /** The live, flat note list straight from the store — never a private copy. */
  notes: Note[]
  books: Book[]
  onOpenBook: (bookId: string) => void
  /** Opens the owning book with this note revealed — the contextual jump. */
  onOpenNote: (bookId: string, noteId: string) => void
  onDeleteNote: (id: string) => void
  /** Opens the page on one note type — «quotes» navigates with `quote`. */
  initialType?: NoteTypeFilter
}

const DEFAULT_QUERY = {
  search: '',
  type: 'all' as NoteTypeFilter,
  bookId: null,
  pageRef: 'any' as PageRefFilter,
  sort: 'newest' as NoteSort,
}

/**
 * Notes & Quotes — every journal entry across the whole library.
 *
 * The list is derived from the same `notes` array the book page and insights
 * read, so an edit or delete anywhere is reflected here with no synchronisation
 * step. Filtering, search and ordering live in `lib/notes`; this component only
 * decides what to render.
 *
 * Deletion reuses the shared confirmation dialog and the existing `deleteNote`
 * action, so there is exactly one code path for removing an entry.
 */
export function NotesLibraryPage({
  notes,
  books,
  onOpenBook,
  onOpenNote,
  onDeleteNote,
  initialType = DEFAULT_QUERY.type,
}: NotesLibraryPageProps) {
  // Local UI state only — the note records themselves are never copied here.
  const [search, setSearch] = useState(DEFAULT_QUERY.search)
  const [type, setType] = useState<NoteTypeFilter>(initialType)
  const [bookId, setBookId] = useState<string | null>(DEFAULT_QUERY.bookId)
  const [pageRef, setPageRef] = useState<PageRefFilter>(DEFAULT_QUERY.pageRef)
  const [sort, setSort] = useState<NoteSort>(DEFAULT_QUERY.sort)
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  // Switching between «notes» and «quotes» re-renders this same component
  // rather than mounting a fresh one, so the requested entry type has to be
  // re-applied when the prop itself changes. Only the type is reset — the
  // user's search, book, page and sort choices are deliberately left alone.
  const [lastInitialType, setLastInitialType] = useState(initialType)
  if (lastInitialType !== initialType) {
    setLastInitialType(initialType)
    setType(initialType)
  }

  const visible = useMemo(
    () => selectNotes(notes, books, { search, type, bookId, pageRef, sort }),
    [notes, books, search, type, bookId, pageRef, sort],
  )

  const bookById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  )

  // Only books that actually hold a note are offered, so the list never shows a
  // choice that would return nothing.
  const annotatedBooks = useMemo(() => booksWithNotes(notes, books), [notes, books])

  const countsByBook = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      counts.set(note.bookId, (counts.get(note.bookId) ?? 0) + 1)
    }
    return counts
  }, [notes])

  const hasQuery = search.trim().length > 0

  const resetAll = () => {
    setSearch('')
    setType('all')
    setBookId(null)
    setPageRef('any')
  }
return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-[0.72rem] tracking-[0.16em] text-ink-faint uppercase">
          همهٔ دفترها
        </p>
        <h1 className="mt-2.5 text-3xl font-semibold text-ink sm:text-4xl">
          یادداشت‌ها و نقل‌قول‌ها
        </h1>
        <p className="mt-4 text-[0.95rem] leading-[2] text-ink-soft">
          هر جمله‌ای که در دفتر خواندن کتاب‌ها نوشته‌اید، از هر کتابی، اینجا کنار هم
          جمع شده است. می‌توانید میانشان بگردید، دسته‌بندی کنید و به کتاب خودشان
          برگردید.
        </p>
        <p className="tabular mt-4 text-sm text-ink-faint">
          {formatNumber(notes.length)} یادداشت در مجموع ·{' '}
          {formatNumber(annotatedBooks.length)} کتاب
        </p>
      </header>

      {/* Toolbar: search, type chips, book + page filters, sorting. */}
      <section className="space-y-4">
        <GlobalSearch
          value={search}
          onChange={setSearch}
          placeholder="جست‌وجو در یادداشت‌ها، نقل‌قول‌ها، عنوان کتاب یا نویسنده…"
          size="xl"
        />

        <NoteTypeFilterBar value={type} onChange={setType} notes={notes} />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookFilterSelect
              books={annotatedBooks}
              value={bookId}
              onChange={setBookId}
              counts={countsByBook}
            />
            <PageRefFilterSelect value={pageRef} onChange={setPageRef} />
          </div>

          <div className="flex items-center gap-4">
            {/* Announced politely so a screen-reader user hears the result count
                change as they type, without stealing focus. */}
            <p
              role="status"
              aria-live="polite"
              data-testid="notes-result-count"
              className="tabular text-[0.78rem] text-ink-soft"
            >
              {formatNumber(visible.length)} نتیجه
            </p>
            <NoteSortControl value={sort} onChange={setSort} />
          </div>
        </div>
      </section>

      {notes.length === 0 ? (
        <EmptyState headingLevel={2}
          icon={NotebookPen}
          title="هنوز هیچ یادداشتی ننوشته‌اید"
          description="هر کتابی که در حال خواندنش هستید، دفتر خواندن خودش را دارد. اولین یادداشت یا نقل‌قولتان را آنجا ثبت کنید و اینجا کنار هم جمع می‌شود."
          action={
            <button
              type="button"
              data-testid="notes-goto-library"
              onClick={() => onOpenBook(annotatedBooks[0]?.id ?? books[0]?.id ?? '')}
              disabled={books.length === 0}
              className={cn('mt-5', PRIMARY_BUTTON)}
            >
              <Library aria-hidden="true" strokeWidth={1.75} className="size-4" />
              رفتن به کتابخانه
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState headingLevel={2}
          icon={SearchX}
          title={
            bookId
              ? 'این کتاب یادداشتی با این شرط‌ها ندارد'
              : 'یادداشتی با این شرط‌ها پیدا نشد'
          }
          description={
            hasQuery
              ? `هیچ یادداشتی با «${search.trim()}» میان این ${formatNumber(notes.length)} یادداشت نیست. املای دیگری را امتحان کنید یا فیلترها را بردارید.`
              : 'با برداشتن فیلترها، یادداشت‌های بیشتری می‌بینید.'
          }
          action={
            <button
              type="button"
              onClick={resetAll}
              data-testid="reset-notes-filters"
              className={cn('mt-5', SECONDARY_BUTTON)}
            >
              برداشتن همهٔ فیلترها
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              compact
              book={bookById.get(note.bookId) ?? null}
              onOpenBook={() => onOpenNote(note.bookId, note.id)}
              onEdit={() => {
                // Editing stays on the book page, where the existing editor and
                // its validation already live, rather than being duplicated.
                onOpenNote(note.bookId, note.id)
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف یادداشت"
        description="این یادداشت برای همیشه حذف می‌شود. اگر تصویری داشته باشد، آن هم پاک می‌گردد."
        confirmLabel="حذف یادداشت"
        destructive
        onConfirm={() => {
          if (pendingDelete) onDeleteNote(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}