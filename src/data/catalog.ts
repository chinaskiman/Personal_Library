/**
 * ---------------------------------------------------------------------------
 *  LOCAL CATALOG — NOT USER DATA, AND NOT LIBRARY CONTENT
 * ---------------------------------------------------------------------------
 * This stands in for a book-search service. It backs the "search then add" tab
 * only: nothing here is ever inserted into the library, and none of it is
 * persisted. The user's library starts empty and holds only what they add.
 *
 * The previous sample *library* — eight invented books merged into every view,
 * plus a fabricated reading-activity panel — has been removed from the codebase
 * entirely. No seed data remains.
 *
 * When a real catalog API arrives, replace this module with a repository that
 * returns the same shape (`CatalogBook`). No component needs to change.
 * ---------------------------------------------------------------------------
 */
import type { CatalogBook } from '@/types/catalog'

/** Flag consumed by the UI to label these results honestly. */
export const IS_DEMO_CATALOG = true

/** Well-known titles offered as search results. Nothing invented. */
export const DEMO_CATALOG: readonly CatalogBook[] = [

  {
    id: 'cat-1',
    title: 'The Left Hand of Darkness',
    author: 'Ursula K. Le Guin',
    isbn: '978-0-441-47812-5',
    publishedYear: 1969,
    pageCount: 304,
    genre: 'Science fiction',
  },
  {
    id: 'cat-2',
    title: 'The Name of the Rose',
    author: 'Umberto Eco',
    isbn: '978-0-15-600131-1',
    publishedYear: 1980,
    pageCount: 512,
    genre: 'Historical fiction',
  },
  {
    id: 'cat-3',
    title: 'Beloved',
    author: 'Toni Morrison',
    isbn: '978-1-4000-3381-6',
    publishedYear: 1987,
    pageCount: 324,
    genre: 'Literary fiction',
  },
  {
    id: 'cat-4',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    isbn: '978-0-15-601086-6',
    publishedYear: 1943,
    pageCount: 96,
    genre: "Children's literature",
  },
  {
    id: 'cat-5',
    title: 'Blindness',
    author: 'José Saramago',
    isbn: '978-0-547-57229-2',
    publishedYear: 1995,
    pageCount: 320,
    genre: 'Literary fiction',
  },
  {
    id: 'cat-6',
    title: 'A Thousand Splendid Suns',
    author: 'Khaled Hosseini',
    isbn: '978-1-4000-4757-9',
    publishedYear: 2007,
    pageCount: 371,
    genre: 'Historical fiction',
  },
  {
    // Also reachable by typing the ISBN, so the search field has both routes
    // exercised. Nothing here is ever added to the library automatically.
    id: 'cat-7',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    isbn: '9780743273565',
    publishedYear: 1925,
    pageCount: 180,
    genre: 'Literary fiction',
  },
] as const
