import type { AddBookRejection, Book, NewBookInput } from '@/types/book'

/**
 * Normalise text for matching.
 *
 * Persian is matched on its *letters only*: harakat, ZWNJ (`می‌خواهم` vs
 * `میخواهم`) and tatweel are stripped, and Arabic letter variants are folded
 * to their Persian forms so `ی/ي` and `ک/ك` compare equal. Latin text is
 * lower-cased and whitespace-collapsed, which makes matching
 * case-insensitive.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْٰ‌ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ی')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip separators so `978-0-671-88816-5` and `9780671888165` match. */
export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '')
}

/** True when a book matches the live search query. */
export function bookMatchesQuery(book: Book, query: string): boolean {
  const needle = normalizeText(query)
  if (!needle) return true

  return [book.title, book.author, book.translatedTitle, book.isbn].some(
    (field) => (field ? normalizeText(field).includes(needle) : false),
  )
}

/** Comparison key for titles, free of decorative quote characters. */
function titleSortKey(book: Book): string {
  return normalizeText(book.title).replace(/^[«"'«]+|[»"'»]+$/g, '')
}

export type LibrarySort =
  | 'recently-added'
  | 'title-asc'
  | 'title-desc'
  | 'progress-desc'

/** Persian labels for the sort control, in menu order. */
export const LIBRARY_SORT_OPTIONS: readonly {
  value: LibrarySort
  label: string
}[] = [
  { value: 'recently-added', label: 'تازه‌ترین افزوده‌شده‌ها' },
  { value: 'title-asc', label: 'عنوان — الف تا ی' },
  { value: 'title-desc', label: 'عنوان — ی تا الف' },
  { value: 'progress-desc', label: 'بیشترین پیشرفت خواندن' },
] as const

/**
 * Sort the collection.
 *
 * `recently-added` sorts on `lastAccessedAt`, the only date the existing data
 * model carries — no invented `createdAt` field is introduced. Ties fall back
 * to title order so the result is stable between renders.
 */
export function sortBooks(books: readonly Book[], sort: LibrarySort): Book[] {
  const list = [...books]
  const byTitle = (a: Book, b: Book) =>
    titleSortKey(a).localeCompare(titleSortKey(b))

  switch (sort) {
    case 'title-asc':
      return list.sort(byTitle)
    case 'title-desc':
      return list.sort((a, b) => byTitle(b, a))
    case 'progress-desc':
      return list.sort((a, b) => b.progress - a.progress || byTitle(a, b))
    case 'recently-added':
    default:
      return list.sort(
        (a, b) =>
          new Date(b.lastAccessedAt).getTime() -
            new Date(a.lastAccessedAt).getTime() || byTitle(a, b),
      )
  }
}

/**
 * Locate an existing record matching the incoming book.
 *
 * ISBN is authoritative when present, since it identifies an edition
 * unambiguously. Without an ISBN the comparison is deliberately cautious —
 * a normalised title *and* a normalised author must both match — so two
 * different editions of the same work are never silently merged.
 */
export function findDuplicate(
  books: readonly Book[],
  candidate: NewBookInput,
): { reason: AddBookRejection; existing: Book } | null {
  const isbn = candidate.isbn ? normalizeIsbn(candidate.isbn.trim()) : ''
  if (isbn) {
    const match = books.find(
      (book) => book.isbn && normalizeIsbn(book.isbn) === isbn,
    )
    if (match) return { reason: 'duplicate-isbn', existing: match }
  }

  const title = normalizeText(candidate.title)
  const author = normalizeText(candidate.author)
  if (!title || !author) return null

  const match = books.find(
    (book) =>
      normalizeText(book.title) === title &&
      normalizeText(book.author) === author,
  )
  return match ? { reason: 'duplicate-title-author', existing: match } : null
}