/**
 * ---------------------------------------------------------------------------
 *  READING INSIGHTS — PURE CALCULATIONS
 * ---------------------------------------------------------------------------
 * Every figure the insights page shows is derived here, from the live library
 * state, and returned as plain data. Nothing in this module reads storage or
 * touches React, so each function can be reasoned about — and tested — on its
 * own. No function mutates its arguments.
 *
 * Two rules govern everything below, and both exist to keep the page honest:
 *
 *  1. NOTES ARE COUNTED FROM REAL RECORDS ONLY. `Book.noteCount` and
 *     `Book.quoteCount` are decorative fields on the bundled demo books; no
 *     `Note` records back them. Summing them would report dozens of journal
 *     entries that were never written, so only the live `Note[]` is trusted.
 *
 *  2. MISSING DATA IS ABSENT, NOT ZERO. A book with no page count is counted
 *     as "unknown", never folded into an average as if it were 0%. An average
 *     that cannot be computed honestly comes back `null` and the UI explains
 *     why instead of showing a misleading figure.
 * ---------------------------------------------------------------------------
 */
import type { Book, BookOrigin, ReadingStatus } from '@/types/book'
import type { Note, NoteType } from '@/types/note'

/** A timestamp that passed validation and is safe to display. */
export type SafeDate = Date

/**
 * Parse an ISO timestamp, rejecting anything unusable.
 *
 * A malformed string yields `NaN` from `Date.parse`, and a date in the future
 * usually means corrupted or hand-edited storage. `now` is injectable so this
 * stays pure and testable.
 */
export function parseTimestamp(
  value: string | undefined | null,
  now: Date = new Date(),
): SafeDate | null {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  // A small tolerance absorbs ordinary clock skew between write and read.
  if (parsed.getTime() > now.getTime() + 60_000) return null

  return parsed
}

/** ------------------------------------------------------------------ *
 *  Library overview
 * ------------------------------------------------------------------ */

export interface LibraryOverview {
  totalBooks: number
  byStatus: Record<ReadingStatus, number>
  /** Split by provenance, so the UI can show what is sample vs. personal. */
  byOrigin: Record<BookOrigin, number>
  /** Counted from live `Note` records — never from `Book.noteCount`. */
  totalNotes: number
  notesByType: Record<NoteType, number>
  /** How many books have at least one journal entry. */
  booksWithNotes: number
  /** Notes whose owning book no longer exists. */
  orphanedNotes: number
}

function emptyStatusCounts(): Record<ReadingStatus, number> {
  return {
    reading: 0,
    'want-to-read': 0,
    finished: 0,
    paused: 0,
    abandoned: 0,
  }
}

/**
 * Collection-level totals.
 *
 * Notes whose `bookId` no longer resolves are counted separately rather than
 * silently inflating the total, so the UI can stay honest if stored records
 * ever fall out of sync.
 */
export function computeLibraryOverview(
  books: readonly Book[],
  notes: readonly Note[],
): LibraryOverview {
  const byStatus = emptyStatusCounts()
  // Every book in the library is one the user added: the bundled sample set has
  // been removed. A record with no `origin` therefore counts as personal, which
  // is the only correct reading now that no sample origin can be produced.
  const byOrigin: Record<BookOrigin, number> = { demo: 0, user: 0 }

  const bookIds = new Set(books.map((book) => book.id))

  for (const book of books) {
    byStatus[book.status] += 1
    byOrigin[book.origin ?? 'user'] += 1
  }

  const notesByType: Record<NoteType, number> = { text: 0, quote: 0, image: 0 }
  let orphanedNotes = 0
  const booksWithNote = new Set<string>()

  for (const note of notes) {
    notesByType[note.type] += 1
    if (bookIds.has(note.bookId)) {
      booksWithNote.add(note.bookId)
    } else {
      orphanedNotes += 1
    }
  }

  return {
    totalBooks: books.length,
    byStatus,
    byOrigin,
    totalNotes: notes.length,
    notesByType,
    booksWithNotes: booksWithNote.size,
    orphanedNotes,
  }
}

/** ------------------------------------------------------------------ *
 *  Reading progress
 * ------------------------------------------------------------------ */

export interface ProgressRow {
  book: Book
  /** 0–1, only present when the book has meaningful recorded progress. */
  progress: number
  /** Present only when both page numbers form a sane pair. */
  currentPage: number | null
  totalPages: number | null
}

export interface ProgressInsight {
  /** Books in the `reading` state that have a recorded progress value. */
  rows: ProgressRow[]
  /** Books marked as reading whose progress has never been recorded. */
  booksWithoutProgress: number
  /**
   * Mean progress across `rows`, or `null` when no book has progress. Never 0
   * as a stand-in for "unknown".
   */
  averageProgress: number | null
  /** Reading books where current and total pages are both valid. */
  booksWithPageData: number
}

/**
 * Progress for books currently being read.
 *
 * A book at `progress: 0` is genuinely "just started" and is included; a book
 * with no meaningful progress value at all is reported separately instead of
 * being averaged in as a zero.
 */
export function computeProgressInsight(books: readonly Book[]): ProgressInsight {
  const rows: ProgressRow[] = []
  let booksWithoutProgress = 0
  let booksWithPageData = 0

  for (const book of books) {
    if (book.status !== 'reading') continue

    const progress = book.progress
    const hasProgress =
      typeof progress === 'number' && Number.isFinite(progress) && progress > 0

    if (!hasProgress) {
      booksWithoutProgress += 1
      continue
    }

    const current = book.currentPage
    const total = book.totalPages

    // Only a sane pair (positive, and current not past the end) is reported.
    const hasPagePair =
      typeof current === 'number' &&
      current > 0 &&
      typeof total === 'number' &&
      total > 0 &&
      current <= total

    if (hasPagePair) booksWithPageData += 1

    rows.push({
      book,
      progress: Math.min(Math.max(progress, 0), 1),
      currentPage: hasPagePair ? (current as number) : null,
      totalPages: hasPagePair ? (total as number) : null,
    })
  }

  const averageProgress =
    rows.length === 0
      ? null
      : rows.reduce((sum, row) => sum + row.progress, 0) / rows.length

  return {
    rows: rows.sort(
      (a, b) => b.progress - a.progress || a.book.title.localeCompare(b.book.title),
    ),
    booksWithoutProgress,
    averageProgress,
    booksWithPageData,
  }
}

/** ------------------------------------------------------------------ *
 *  Activity over time
 * ------------------------------------------------------------------ */

/** How many trailing weeks the activity chart covers. */
export const ACTIVITY_WEEKS = 12

export interface ActivityBucket {
  /** ISO date (YYYY-MM-DD) of the Persian week's first day. */
  weekStart: string
  /** Persian label, e.g. «۱۲ آبان». */
  label: string
  count: number
  /** True for the current, possibly incomplete, week. */
  isCurrent: boolean
}

/** Persian week starts on Saturday (JS `getDay()` returns 6). */
const PERSIAN_WEEK_FIRST_DAY = 6

/** Midnight on the Saturday that begins the Persian week containing `date`. */
export function startOfPersianWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (start.getDay() - PERSIAN_WEEK_FIRST_DAY + 7) % 7
  start.setDate(start.getDate() - offset)
  return start
}

function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const shortDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'short',
})

/**
 * Notes created per Persian week across the trailing `ACTIVITY_WEEKS`.
 *
 * This counts journal entries — something the app genuinely records. It is
 * deliberately *not* a reading-volume chart: there is no session tracking, so
 * claiming "pages read per week" would be invention.
 */
export function buildNoteActivity(
  notes: readonly Note[],
  now: Date = new Date(),
  weeks: number = ACTIVITY_WEEKS,
): ActivityBucket[] {
  const currentWeekStart = startOfPersianWeek(now)

  // Pre-seed every bucket so gaps read as genuinely empty weeks.
  const buckets: ActivityBucket[] = []
  const indexByWeek = new Map<string, ActivityBucket>()

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - offset * 7)

    const bucket: ActivityBucket = {
      weekStart: toIsoDay(start),
      label: shortDateFormatter.format(start),
      count: 0,
      isCurrent: offset === 0,
    }
    buckets.push(bucket)
    indexByWeek.set(bucket.weekStart, bucket)
  }

  for (const note of notes) {
    const created = parseTimestamp(note.createdAt, now)
    if (!created) continue

    const bucket = indexByWeek.get(toIsoDay(startOfPersianWeek(created)))
    if (bucket) bucket.count += 1
  }

  return buckets
}

/** ------------------------------------------------------------------ *
 *  Recent activity
 * ------------------------------------------------------------------ */

export type ActivityEventKind = 'note-created' | 'note-updated' | 'book-accessed'

export interface ActivityEvent {
  /** Unique and stable per event, safe as a React key. */
  id: string
  kind: ActivityEventKind
  at: Date
  /** Resolved when the related book still exists; `null` if it was deleted. */
  book: Book | null
  /** Present only for note events. */
  noteType?: NoteType
}

export interface RecentActivity {
  events: ActivityEvent[]
  /** True when nothing at all could be derived. */
  isEmpty: boolean
}

/**
 * The most recent journal and access events, newest first.
 *
 * Each note contributes exactly one event — its edit if it was revised,
 * otherwise its creation — so a single note never appears twice. Book access
 * events come from `lastAccessedAt`, which the app records when a book is
 * opened or edited; that is surfaced strictly as an *access* event and never
 * as a reading session, because the app does not track reading time.
 */
export function buildRecentActivity(
  books: readonly Book[],
  notes: readonly Note[],
  now: Date = new Date(),
  limit = 12,
): RecentActivity {
  const booksById = new Map(books.map((book) => [book.id, book]))
  const events: ActivityEvent[] = []

  for (const note of notes) {
    const created = parseTimestamp(note.createdAt, now)
    const updated = parseTimestamp(note.updatedAt, now)

    // Prefer the edit, but only when it is genuinely later than the creation.
    const edited = Boolean(updated && created && updated.getTime() > created.getTime())
    const at = edited ? updated : created
    if (!at) continue

    events.push({
      id: edited ? `note-updated:${note.id}` : `note-created:${note.id}`,
      kind: edited ? 'note-updated' : 'note-created',
      at,
      book: booksById.get(note.bookId) ?? null,
      noteType: note.type,
    })
  }

  for (const book of books) {
    const accessed = parseTimestamp(book.lastAccessedAt, now)
    if (!accessed) continue

    events.push({
      id: `book-accessed:${book.id}`,
      kind: 'book-accessed',
      at: accessed,
      book,
    })
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime())

  return { events: events.slice(0, limit), isEmpty: events.length === 0 }
}