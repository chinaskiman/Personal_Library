import type { ReadingStatus } from './book'

/**
 * A candidate returned by the add-book search tab.
 *
 * This mirrors what a real catalog API would return. Fields are optional
 * because a real record is often incomplete, and the UI must degrade
 * gracefully rather than render blanks or invented values.
 */
export interface CatalogBook {
  /** Stable identifier for this catalog entry. */
  id: string
  /** Original title — rendered LTR. */
  title: string
  /** Author name — rendered LTR. */
  author: string
  isbn?: string
  publishedYear?: number
  pageCount?: number
  genre?: string
  /** Optional local cover asset; never a remote URL. */
  coverImage?: string
}

/** The two ways a book can enter the library. */
export type AddBookTab = 'search' | 'manual'

/** Reading statuses offered when adding a book. */
export const ADDABLE_STATUSES: readonly ReadingStatus[] = [
  'want-to-read',
  'reading',
  'finished',
] as const