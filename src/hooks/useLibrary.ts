import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { deleteImage, deleteImages, isImageRef } from '@/lib/imageStore'
import { findDuplicate } from '@/lib/library'
import { loadPersisted, savePersisted } from '@/lib/persistence'
import type {
  AddBookResult,
  Book,
  EditBookInput,
  NewBookInput,
  ReadingStatus,
} from '@/types/book'
import type { NewNoteInput, Note } from '@/types/note'

export interface UseLibraryResult {
  /** The live collection, newest additions included. */
  books: Book[]
  /** Book counts keyed by status, plus the total. */
  counts: Record<ReadingStatus, number> & { total: number }
  /** Journal notes, all books, keyed by book id. */
  notesByBook: Record<string, Note[]>
  /** The same notes as one flat list, for cross-book views like insights. */
  notes: Note[]
  /** Add a book, refusing duplicates. */
  addBook: (input: NewBookInput) => AddBookResult
  /** Patch a book's metadata. No-op for an unknown id. */
  updateBook: (id: string, patch: EditBookInput) => void
  /** Change status and, when relevant, progress in one step. */
  setBookStatus: (
    id: string,
    status: ReadingStatus,
    progressPercent?: number,
  ) => void
  /** Remove a book with its notes and images. */
  deleteBook: (id: string) => void
  addNote: (input: NewNoteInput) => Note
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'bookId'>>) => void
  deleteNote: (id: string) => void
  /**
   * Replace or extend the persisted user data in one step.
   *
   * Used by backup restore. The whole set is committed together so the library
   * can never be observed half-imported, and the existing `savePersisted` effect
   * writes it exactly like any other change — there is no second code path.
   */
  importRecords: (records: {
    books: Book[]
    overrides: Record<string, Partial<Book>>
    notes: Note[]
  }) => void
  /**
   * Remove every record: books, notes, and the images belonging to them.
   *
   * The bundled sample library has been removed, so this leaves the app in the
   * same state as a fresh install.
   */
  clearUserData: () => void
  /**
   * The user's books.
   *
   * Backup export needs this exact set, which is now the whole collection.
   */
  userBooks: Book[]
  /**
   * User edits layered onto books, keyed by book id.
   *
   * Retained for schema and backup compatibility: the format still round-trips an
   * `overrides` map, even though no bundled books remain for it to address.
   */
  overrides: Record<string, Partial<Book>>
  /** False once a write has failed, so the UI can warn the user. */
  persisted: boolean
}

function countByStatus(books: readonly Book[]) {
  const counts = {
    'want-to-read': 0,
    reading: 0,
    finished: 0,
    paused: 0,
    abandoned: 0,
    total: books.length,
  } as Record<ReadingStatus, number> & { total: number }

  for (const book of books) counts[book.status] += 1
  return counts
}

/** Stable id generator that does not need `crypto`. */
function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`
}

/**
 * The library collection, held in client-side state for now.
 *
/**
 * Build the visible collection.
 *
 * The application used to merge a bundled sample library into this list. That
 * sample set has been removed, so the collection is now exactly what the user
 * has added — nothing else is injected, and a fresh install renders empty.
 */
function composeBooks(userBooks: Book[]): Book[] {
  return userBooks
}

/** Group notes by parent book, newest first within each group. */
function groupNotes(notes: Note[]): Record<string, Note[]> {
  const grouped: Record<string, Note[]> = {}

  for (const note of notes) {
    ;(grouped[note.bookId] ??= []).push(note)
  }

  for (const list of Object.values(grouped)) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return grouped
}

/**
 * The library: books, reading status, and the per-book reading journal.
 *
 * Persistence is layered on top of in-memory state rather than replacing it, so
 * a browser with storage disabled still behaves exactly as before — the user
 * simply loses their changes on refresh, and `persisted` reports `false` so the
 * UI can say so plainly.
 */
export function useLibrary(): UseLibraryResult {
  // Hydrated once, synchronously, on first render so the first paint already
  // shows saved data — no flash of an empty shelf.
  const initial = useRef(loadPersisted()).current

  const [userBooks, setUserBooks] = useState<Book[]>(initial.books)
  const [overrides, setOverrides] = useState<Record<string, Partial<Book>>>(
    initial.overrides,
  )
  const [notes, setNotes] = useState<Note[]>(initial.notes)
  const [persisted, setPersisted] = useState(true)

  /** Apply a change to one book. No-op for an unknown id. */
  const patchBook = useCallback((id: string, patch: Partial<Book>) => {
    setUserBooks((current) =>
      current.map((book) => (book.id === id ? { ...book, ...patch } : book)),
    )
  }, [])

  // Every mutation writes through. Writes are fire-and-forget and never throw;
  // a failure flips `persisted` so the shell can warn the user. When the stored
  // data came from a newer build we stay read-only rather than clobber it.
  useEffect(() => {
    if (!initial.writable) return
    const ok = savePersisted({ books: userBooks, overrides, notes })
    if (!ok) setPersisted(false)
  }, [userBooks, overrides, notes, initial.writable])

  const allBooks = useMemo(() => composeBooks(userBooks), [userBooks])

  const addBook = useCallback(
    (input: NewBookInput): AddBookResult => {
      const duplicate = findDuplicate(allBooks, input)
      if (duplicate) return { ok: false, ...duplicate }

      const now = new Date().toISOString()
      const isReading = input.status === 'reading'
      const ratio =
        isReading && input.progressPercent
          ? Math.min(Math.max(input.progressPercent, 0), 100) / 100
          : 0

      const book: Book = {
        id: makeId('book'),
        title: input.title.trim(),
        author: input.author.trim(),
        isbn: input.isbn?.trim() || undefined,
        publishedYear: input.publishedYear,
        genre: input.genre?.trim() || undefined,
        translatedTitle: input.translatedTitle?.trim() || undefined,
        status: input.status,
        shelf: 'personal',
        origin: 'user',
        progress: input.status === 'finished' ? 1 : ratio,
        totalPages: input.totalPages,
        currentPage:
          isReading && input.totalPages ? Math.round(ratio * input.totalPages) : undefined,
        coverImage: input.coverImage,
        lastAccessedAt: now,
        startedAt: isReading || input.status === 'finished' ? now : undefined,
        finishedAt: input.status === 'finished' ? now : undefined,
        noteCount: 0,
        quoteCount: 0,
      }

      // Re-check inside the updater so two rapid adds in one tick cannot
      // both slip past the check above.
      setUserBooks((current) =>
        findDuplicate(current, input) ? current : [book, ...current],
      )

      return { ok: true, book }
    },
    [allBooks, overrides],
  )
const updateBook = useCallback(
    (id: string, patch: EditBookInput) => {
      // Normalise empty strings to `undefined` so clearing a field actually
      // removes it rather than persisting an empty value.
      const clean: Partial<Book> = {}
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed) (clean as Record<string, unknown>)[key] = trimmed
        } else if (value !== undefined) {
          (clean as Record<string, unknown>)[key] = value
        }
      }

      patchBook(id, { ...clean, lastAccessedAt: new Date().toISOString() })
    },
    [patchBook],
  )

  const setBookStatus = useCallback(
    (id: string, status: ReadingStatus, progressPercent?: number) => {
      const book = allBooks.find((entry) => entry.id === id)
      if (!book) return

      const now = new Date().toISOString()
      const patch: Partial<Book> = { status, lastAccessedAt: now }

      // Progress is only meaningful while reading, and completing a book
      // implies full progress.
      if (status === 'finished') {
        patch.progress = 1
        patch.finishedAt = now
        if (book.totalPages) patch.currentPage = book.totalPages
      } else if (status === 'reading') {
        const ratio =
          progressPercent === undefined
            ? book.progress
            : Math.min(Math.max(progressPercent, 0), 100) / 100
        patch.progress = ratio
        patch.startedAt = book.startedAt ?? now
        patch.finishedAt = undefined
        if (book.totalPages) patch.currentPage = Math.round(ratio * book.totalPages)
      } else {
        patch.progress = 0
        patch.finishedAt = undefined
        patch.currentPage = undefined
      }

      patchBook(id, patch)
    },
    [allBooks, patchBook],
  )

  const deleteBook = useCallback(
    (id: string) => {
      const book = allBooks.find((entry) => entry.id === id)
      // Every book in the collection is now one the user added; there is no
      // bundled sample set left to protect.
      if (!book) return

      const owned = notes.filter((note) => note.bookId === id)
      const images = [
        book.coverImage,
        ...owned.map((note) => note.imageRef),
      ].filter(isImageRef)

      // Remove images before state so a failure cannot orphan the records.
      void deleteImages(images)
      setNotes((current) => current.filter((note) => note.bookId !== id))
      setUserBooks((current) => current.filter((entry) => entry.id !== id))
    },
    [allBooks, notes],
  )

  const addNote = useCallback((input: NewNoteInput): Note => {
    const note: Note = {
      id: makeId('note'),
      bookId: input.bookId,
      type: input.type,
      content: input.content.trim(),
      page: input.page,
      imageRef: input.imageRef,
      createdAt: new Date().toISOString(),
    }

    setNotes((current) => [note, ...current])
    return note
  }, [])

  const updateNote = useCallback(
    (id: string, patch: Partial<Omit<Note, 'id' | 'bookId'>>) => {
      setNotes((current) =>
        current.map((note) =>
          note.id === id
            ? {
                ...note,
                ...patch,
                content: patch.content !== undefined ? patch.content.trim() : note.content,
                updatedAt: new Date().toISOString(),
              }
            : note,
        ),
      )
    },
    [],
  )

  const deleteNote = useCallback((id: string) => {
    const note = notes.find((entry) => entry.id === id)
    if (note?.imageRef && isImageRef(note.imageRef)) void deleteImage(note.imageRef)
    setNotes((current) => current.filter((entry) => entry.id !== id))
  }, [notes])

  const counts = useMemo(() => countByStatus(allBooks), [allBooks])
  const notesByBook = useMemo(() => groupNotes(notes), [notes])

  /**
   * Commit a whole record set at once.
   *
   * All three states are set in the same commit so React never renders a
   * library with the new books but the old notes. The existing persistence
   * effect then writes the result through `savePersisted`, keeping a single
   * write path for both ordinary edits and a restore.
   */
  const importRecords = useCallback(
    (records: { books: Book[]; overrides: Record<string, Partial<Book>>; notes: Note[] }) => {
      setUserBooks(records.books)
      setOverrides(records.overrides)
      setNotes(records.notes)
    },
    [],
  )

  /**
   * Wipe user-created data, keeping the bundled sample library.
   *
   * The caller is responsible for pruning stored images, and it must do so only
   * *after* calling this — deleting them first would leave these records, which
   * are still rendered until React commits, pointing at nothing.
   *
   * Sample books are returned to their bundled state rather than deleted, since
   * they ship with the app.
   */
  const clearUserData = useCallback(() => {
    setUserBooks([])
    setOverrides({})
    setNotes([])
  }, [])

  return {
    books: allBooks,
    counts,
    notesByBook,
    // The canonical list, shared rather than re-derived: `notesByBook` groups
    // these very records, so consumers must not keep a second copy.
    notes,
    addBook,
    updateBook,
    setBookStatus,
    deleteBook,
    addNote,
    updateNote,
    deleteNote,
    importRecords,
    clearUserData,
    userBooks,
    overrides,
    persisted,
  }
}
