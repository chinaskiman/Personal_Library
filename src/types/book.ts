/**
 * Reading status of a book within the journal.
 * The string values are stable identifiers (safe for persistence later);
 * their Persian labels live in `src/data/readingStatus.ts`.
 */
export type ReadingStatus =
  | 'want-to-read'
  | 'reading'
  | 'finished'
  | 'paused'
  | 'abandoned'

/** Where a book sits in the user's mental shelf. */
export type BookShelf = 'personal' | 'reference'

/**
 * Provenance of a record.
 *
 * `demo` books come from the bundled sample data and can never be deleted;
 * `user` books were created in this browser and are the only deletable ones.
 * The distinction is what lets persistence layer user edits over the demo set
 * without ever overwriting it.
 */
export type BookOrigin = 'demo' | 'user'

export interface Book {
  id: string
  /** Original (often English) title — always rendered LTR. */
  title: string
  /** Optional Persian / transliterated title shown beneath the original. */
  translatedTitle?: string
  /** Author name — always rendered LTR. */
  author: string
  /** ISBN-13 — always rendered LTR with tabular figures. */
  isbn?: string
  status: ReadingStatus
  shelf: BookShelf
  /** Defaults to `demo`; set once, when the book enters the user's library. */
  origin?: BookOrigin
  /** Publication year, when known. */
  publishedYear?: number
  /** Free-text genre / category, when known. */
  genre?: string
  /** Overall progress, 0–100. */
  progress: number
  totalPages?: number
  currentPage?: number
  /**
   * Cover reference. Either an `idb:<key>` reference resolved through the image
   * store, or a built-in asset path. Never a `blob:` URL — those die with the
   * document and cannot survive a refresh.
   */
  coverImage?: string
  /** ISO date the book was last opened. */
  lastAccessedAt: string
  startedAt?: string
  finishedAt?: string
  /** Counts are pre-computed for now; real aggregation comes later. */
  noteCount?: number
  quoteCount?: number
}

/**
 * Payload accepted when the user adds a book, from either dialog tab.
 * Everything optional is genuinely optional — nothing here is invented
 * server-side, and every field maps 1:1 onto `Book`.
 */
export interface NewBookInput {
  title: string
  author: string
  isbn?: string
  publishedYear?: number
  totalPages?: number
  genre?: string
  translatedTitle?: string
  status: ReadingStatus
  /** 0–100. Only meaningful for `status === 'reading'`. */
  progressPercent?: number
  /** `idb:<key>` reference from the image store, or undefined. */
  coverImage?: string
}

/**
 * Fields the user may change on an existing book.
 *
 * Deliberately the same shape as `NewBookInput` minus `status`/progress, which
 * have dedicated flows on the details page. An omitted field is left untouched.
 */
export type EditBookInput = Partial<
  Omit<NewBookInput, 'status' | 'progressPercent'>
>

/** Why an add was refused — surfaced verbatim to the user. */
export type AddBookRejection = 'duplicate-isbn' | 'duplicate-title-author'

/** Discriminated result so the dialog can react without guessing. */
export type AddBookResult =
  | { ok: true; book: Book }
  | { ok: false; reason: AddBookRejection; existing: Book }

