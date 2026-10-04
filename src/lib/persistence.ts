import { readJson, removeKey, writeJson } from './storage'
import type { Book, ReadingStatus } from '@/types/book'
import type { Note, NoteType } from '@/types/note'

/**
 * Current schema version.
 *
 * Bump this whenever the shape below changes and add a case to `migrate`, so
 * data saved by an older build keeps working. A version *newer* than this
 * build is left untouched rather than rewritten.
 */
export const SCHEMA_VERSION = 1

const KEY_ROOT = 'reading-journal'

export const STORAGE_KEYS = {
  version: `${KEY_ROOT}:version`,
  books: `${KEY_ROOT}:books`,
  notes: `${KEY_ROOT}:notes`,
} as const

/**
 * The persisted shape.
 *
 * `books` holds only user-created books. Demo books always come from the
 * bundled module and user edits to them live in `overrides`, so sample data
 * can never be overwritten by initialisation.
 */
export interface PersistedState {
  books: Book[]
  overrides: Record<string, Partial<Book>>
  notes: Note[]
}

export const EMPTY_STATE: PersistedState = {
  books: [],
  overrides: {},
  notes: [],
}

/**
 * Outcome of loading persisted state.
 *
 * `writable` is false when the stored data was written by a newer build. The
 * app then runs purely on demo data and must **not** write back, or it would
 * silently destroy data it does not understand.
 */
export interface LoadResult extends PersistedState {
  writable: boolean
}

/**
 * Load persisted state.
 *
 * Guards at four levels: unavailable storage, unreadable JSON, an unknown
 * version, and finally per-record shape. Every failure degrades to empty rather
 * than throwing, so a corrupt store costs the user their saved data but never
 * their ability to open the app.
 */
export function loadPersisted(): LoadResult {
  const version = readJson<unknown>(STORAGE_KEYS.version, 0)

  if (typeof version !== 'number' || version <= 0) {
    return { ...EMPTY_STATE, writable: true }
  }
  // Written by a newer build: adopt nothing and stay read-only so we do not
  // overwrite data this build cannot interpret.
  if (version > SCHEMA_VERSION) {
    return { ...EMPTY_STATE, writable: false }
  }

  const raw = readJson<Partial<PersistedState> | null>(STORAGE_KEYS.books, null)
  const rawNotes = readJson<unknown>(STORAGE_KEYS.notes, [])

  // `migrate` transforms an older payload in place; it is not a data source.
  const data = migrate(version, {
    books: sanitizeRecords(raw?.books),
    overrides: raw?.overrides ?? {},
    notes: sanitizeRecords(rawNotes),
  })

  return {
    books: sanitizeBooks(data.books),
    overrides: sanitizeOverrides(data.overrides),
    notes: sanitizeNotes(data.notes),
    writable: true,
  }
}

/** Loosely-typed payload passed through migration before validation. */
interface RawPayload {
  books: Record<string, unknown>[]
  overrides: unknown
  notes: Record<string, unknown>[]
}

/**
 * Bring an older payload up to the current shape.
 *
 * v1 is the first released schema, so there is nothing older to rewrite yet —
 * the function is the seam where a future shape change lands. Later versions
 * should read `fromVersion` and transform only the parts that differ.
 */
function migrate(_version: number, payload: RawPayload): RawPayload {
  return payload
}

/** Persist state. Returns `false` when the store refused the write. */
export function savePersisted(state: PersistedState): boolean {
  if (!writeJson(STORAGE_KEYS.version, SCHEMA_VERSION).ok) return false
  if (!writeJson(STORAGE_KEYS.books, {
    books: state.books,
    overrides: state.overrides,
  }).ok) {
    return false
  }
  return writeJson(STORAGE_KEYS.notes, state.notes).ok
}

/** Drop everything this app has stored. */
export function clearPersisted(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeKey(key)
}

/* ------------------------------------------------------------------ *
 * Sanitisers — each keeps only records that are safe to render.
 * ------------------------------------------------------------------ */

function sanitizeRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object',
      )
    : []
}

function sanitizeBooks(records: Record<string, unknown>[]): Book[] {
  const books: Book[] = []

  for (const record of records) {
    const id = str(record.id)
    const title = str(record.title)
    const author = str(record.author)
    // Without these the card cannot render; skip rather than half-render.
    if (!id || !title || !author) continue

    books.push({
      ...(record as unknown as Book),
      id,
      title,
      author,
      origin: 'user',
      status: isStatus(record.status) ? record.status : 'want-to-read',
      progress: clampNumber(record.progress, 0, 1) ?? 0,
    })
  }

  return books
}

/**
 * Overrides are a map keyed by book id, not a list — so this iterates entries
 * rather than filtering an array. Only string values are kept, and the `id`
 * field is dropped because the key already carries it.
 */
function sanitizeOverrides(value: unknown): Record<string, Partial<Book>> {
  const overrides: Record<string, Partial<Book>> = {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return overrides
  }

  for (const [id, patch] of Object.entries(value as Record<string, unknown>)) {
    if (!id || patch === null || typeof patch !== 'object') continue
    const { id: _ignored, ...rest } = patch as Record<string, unknown>
    overrides[id] = rest as Partial<Book>
  }

  return overrides
}

function sanitizeNotes(value: unknown): Note[] {
  const notes: Note[] = []

  for (const record of sanitizeRecords(value)) {
    const id = str(record.id)
    const bookId = str(record.bookId)
    const createdAt = str(record.createdAt)
    // Without a parent or a timestamp a note cannot be ordered or rendered.
    if (!id || !bookId || !createdAt) continue

    const page = clampNumber(record.page, 1, 100000)

    notes.push({
      id,
      bookId,
      type: isNoteType(record.type) ? record.type : 'text',
      content: str(record.content),
      createdAt,
      updatedAt: str(record.updatedAt) || undefined,
      page: page === null ? undefined : Math.round(page),
      // Drop legacy `blob:` references: they are invalid after a refresh.
      imageRef: safeImageRef(record.imageRef),
    })
  }

  return notes
}

/**
 * Accept only references the image store can resolve. Anything else — notably
 * a `blob:` URL left over from a previous session — is discarded so the UI
 * falls back to a placeholder rather than a broken image.
 */
function safeImageRef(value: unknown): string | undefined {
  const ref = str(value)
  if (!ref) return undefined
  if (ref.startsWith('blob:') || ref.startsWith('data:')) return undefined
  return ref
}

/* ---------------------------- helpers ----------------------------- */

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** The number when in range, else `null`. */
function clampNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.max(parsed, min), max)
}

function isStatus(value: unknown): value is ReadingStatus {
  return (
    value === 'want-to-read' ||
    value === 'reading' ||
    value === 'finished' ||
    value === 'paused' ||
    value === 'abandoned'
  )
}

function isNoteType(value: unknown): value is NoteType {
  return value === 'text' || value === 'quote' || value === 'image'
}