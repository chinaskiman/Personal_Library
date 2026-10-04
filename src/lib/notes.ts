/**
 * ---------------------------------------------------------------------------
 *  NOTES LIBRARY — PURE SEARCH / FILTER / SORT
 * ---------------------------------------------------------------------------
 * Everything the Notes & Quotes page needs to narrow a collection, kept out of
 * the components so it can be reasoned about and tested on its own. No function
 * mutates its input; every one returns a new array.
 *
 * The single rule these functions exist to uphold: notes are counted from real
 * `Note` records only. `Book.noteCount` / `Book.quoteCount` are decorative
 * fields on the bundled demo books with no `Note` records behind them, so
 * trusting them would report dozens of entries that were never written.
 * ---------------------------------------------------------------------------
 */
// Relative, unlike the rest of the app: this module is imported directly by
// the Node test runner, which does not resolve the `@/` path alias.
import { normalizeText } from './library.ts'
import type { Book } from '@/types/book'
import type { Note, NoteType } from '@/types/note'

/* ------------------------------------------------------------------ *
 *  Search
 * ------------------------------------------------------------------ */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/**
 * Fold Persian (and Arabic-Indic) digits to Latin so a page number typed as
 * either «۱۲» or «12» matches the stored numeric value.
 */
export function latinizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/**
 * True when a note matches the query.
 *
 * The haystack covers the note body, its book title and author, and its page
 * reference. Both sides go through `normalizeText`, which already folds Persian
 * letter variants and ZWNJ and lower-cases Latin, so «مي‌خواهم» matches
 * «می خواهم» and an English search is case-insensitive.
 */
export function noteMatchesQuery(
  note: Note,
  query: string,
  book: Book | null,
): boolean {
  const needle = normalizeText(query)
  if (!needle) return true

  const haystack = [note.content, book?.title, book?.author].filter(
    (field): field is string => typeof field === 'string' && field.length > 0,
  )

  // A page number is stored as a number, so it is compared numerically rather
  // than by substring — otherwise «۱» would match page 120.
  const digits = latinizeDigits(needle).replace(/\D/g, '')
  if (digits && note.page !== undefined && String(note.page) === digits) return true

  return haystack.some((field) => normalizeText(field).includes(needle))
}

/* ------------------------------------------------------------------ *
 *  Filtering
 * ------------------------------------------------------------------ */

/** `all` plus the three note types the data model defines. */
export type NoteTypeFilter = 'all' | NoteType

/** `with` keeps only notes carrying a page reference. */
export type PageRefFilter = 'any' | 'with' | 'without'

/* ------------------------------------------------------------------ *
 *  Sorting
 * ------------------------------------------------------------------ */

export type NoteSort =
  | 'newest'
  | 'oldest'
  | 'recently-updated'
  | 'book-title'

/** Persian labels for the sort control, in menu order. */
export const NOTE_SORT_OPTIONS: readonly { value: NoteSort; label: string }[] = [
  { value: 'newest', label: 'تازه‌ترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'recently-updated', label: 'آخرین ویرایش' },
  { value: 'book-title', label: 'عنوان کتاب — الف تا ی' },
] as const

/** Milliseconds for a timestamp, or `-Infinity` when it is unusable. */
function timeOf(iso: string | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

/**
 * Sort notes for reading.
 *
 * Every comparison falls back to the note id, so entries whose sort values are
 * identical — including two notes created in the same millisecond, or several
 * with no valid timestamp at all — keep a fixed order instead of shuffling
 * between renders. Undated notes sort last rather than first, since they are
 * the least informative.
 */
export function sortNotes(
  notes: readonly Note[],
  sort: NoteSort,
  booksById: ReadonlyMap<string, Book> = new Map(),
): Note[] {
  const list = [...notes]

  const byId = (a: Note, b: Note) => a.id.localeCompare(b.id)

  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt) || byId(a, b))

    case 'recently-updated':
      return list.sort((a, b) => {
        const au = timeOf(a.updatedAt)
        const bu = timeOf(b.updatedAt)
        // Prefer the edit; fall back to creation so an unedited note still has
        // a meaningful position rather than sinking to the bottom.
        const aKey = au === Number.NEGATIVE_INFINITY ? timeOf(a.createdAt) : au
        const bKey = bu === Number.NEGATIVE_INFINITY ? timeOf(b.createdAt) : bu
        return bKey - aKey || timeOf(b.createdAt) - timeOf(a.createdAt) || byId(a, b)
      })

    case 'book-title':
      return list.sort((a, b) => {
        const at = booksById.get(a.bookId)?.title ?? ''
        const bt = booksById.get(b.bookId)?.title ?? ''
        // A missing book sorts last but keeps a stable position among equals.
        if (!at && bt) return 1
        if (at && !bt) return -1
        return normalizeText(at).localeCompare(normalizeText(bt), 'fa') || byId(a, b)
      })

    case 'newest':
    default:
      return list.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt) || byId(a, b))
  }
}

/* ------------------------------------------------------------------ *
 *  Selection
 * ------------------------------------------------------------------ */

export interface NoteQuery {
  search: string
  type: NoteTypeFilter
  /** Book id, or `null` for every book. Stable ids keep same-titled books apart. */
  bookId: string | null
  pageRef: PageRefFilter
  sort: NoteSort
}

/**
 * Apply search and filters together, then sort.
 *
 * Filters are conjunctive — a note must satisfy every one — and a book filter
 * for a book that no longer exists yields nothing rather than silently
 * reverting to the whole library.
 */
export function selectNotes(
  notes: readonly Note[],
  books: readonly Book[],
  query: NoteQuery,
): Note[] {
  const bookById = new Map(books.map((book) => [book.id, book]))

  const filtered = notes.filter((note) => {
    if (query.type !== 'all' && note.type !== query.type) return false
    if (query.bookId !== null && note.bookId !== query.bookId) return false

    if (query.pageRef === 'with' && note.page === undefined) return false
    if (query.pageRef === 'without' && note.page !== undefined) return false

    return noteMatchesQuery(note, query.search, bookById.get(note.bookId) ?? null)
  })

  return sortNotes(filtered, query.sort, bookById)
}

/* ------------------------------------------------------------------ *
 *  Counts
 * ------------------------------------------------------------------ */

/**
 * Counts per note type across the whole collection.
 *
 * Used for the filter chips, so they show what exists in total rather than what
 * survives the other active filters.
 */
export function countByType(notes: readonly Note[]): Record<NoteTypeFilter, number> {
  const counts: Record<NoteTypeFilter, number> = {
    all: notes.length,
    text: 0,
    quote: 0,
    image: 0,
  }
  for (const note of notes) counts[note.type] += 1
  return counts
}

/** Books that actually own at least one note, most recently written first. */
export function booksWithNotes(
  notes: readonly Note[],
  books: readonly Book[],
): Book[] {
  const latestByBook = new Map<string, number>()

  for (const note of notes) {
    const t = timeOf(note.createdAt)
    const current = latestByBook.get(note.bookId)
    if (current === undefined || t > current) latestByBook.set(note.bookId, t)
  }

  return books
    .filter((book) => latestByBook.has(book.id))
    .sort((a, b) => (latestByBook.get(b.id) ?? 0) - (latestByBook.get(a.id) ?? 0))
}