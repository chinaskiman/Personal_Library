/**
 * ---------------------------------------------------------------------------
 *  BACKUP FORMAT â€” SERIALIZATION, VALIDATION AND MERGE PLANNING
 * ---------------------------------------------------------------------------
 * A backup is a single portable JSON document containing everything needed to
 * reconstruct a user's library on another browser or device. This module owns
 * the format and every rule about what may enter or leave it. It performs no
 * storage and no I/O, so all of it is directly testable.
 *
 * Format decisions worth knowing:
 *
 * - IMAGES TRAVEL AS DATA URLs. `idb:` references are local storage keys with
 *   no meaning elsewhere, and `blob:` URLs die with the document, so neither is
 *   portable. Each asset is inlined as a base64 data URL and every reference
 *   inside books and notes is rewritten to match.
 *
 * - DEMO BOOKS ARE NOT DUMPED. They ship with the application, so a backup that
 *   embedded them would bloat every file and could not be restored by a future
 *   build with different samples. What the user actually owns â€” their edits to
 *   demo books (`overrides`) and their notes on them â€” is included.
 *
 * - VALIDATION NEVER THROWS. A hostile file is data, not code: nothing is
 *   evaluated, prototype-polluting keys are dropped, and a backup failing any
 *   check resolves to a typed reason the UI can explain in Persian.
 * ---------------------------------------------------------------------------
 */
import type { Book, ReadingStatus } from '@/types/book'
import type { Note, NoteType } from '@/types/note'

/**
 * Backup format version.
 *
 * Independent of `SCHEMA_VERSION` (the on-disk store): this describes the
 * *export file*, and a backup taken by an older build must stay readable. A file
 * newer than this is refused rather than partially understood.
 */
export const BACKUP_FORMAT_VERSION = 1

/** MIME type and extension for the download. */
export const BACKUP_MIME = 'application/json'
export const BACKUP_EXTENSION = '.json'

/** Refuse absurd files before parsing them into memory. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024 // 64 MB
/** Guard against a single pathological asset inside an otherwise valid file. */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024 // 8 MB per image

const STATUSES: readonly ReadingStatus[] = [
  'want-to-read',
  'reading',
  'finished',
  'paused',
  'abandoned',
]
const NOTE_TYPES: readonly NoteType[] = ['text', 'quote', 'image']

/** An image inlined into the backup. */
export interface BackupAsset {
  /**
   * Reference *within the backup file* (e.g. `img-abc123`). Not an `idb:`
   * reference â€” keys are reassigned on restore so a merge cannot collide with
   * assets already in the receiving browser.
   */
  key: string
  /** Base64 data URL, e.g. `data:image/png;base64,...`. */
  dataUrl: string
  /** MIME type, used to rebuild the Blob on restore. */
  mimeType: string
}

export interface BackupFile {
  /** Format version, so an unknown file is refused rather than guessed at. */
  formatVersion: number
  /** Application that wrote the file, for the user's own reassurance. */
  app: { name: string; version: string }
  /** ISO timestamp of the export. */
  exportedAt: string
  books: Book[]
  /** User edits to bundled demo books, keyed by demo book id. */
  overrides: Record<string, Partial<Book>>
  notes: Note[]
  assets: BackupAsset[]
}

/** Why a backup was refused. Each maps to a Persian message in the UI. */
export type BackupRejection =
  | 'unreadable'
  | 'not-an-object'
  | 'missing-format'
  | 'unsupported-version'
  | 'no-records'
  | 'too-large'

export type ValidateResult =
  | {
      ok: true
      backup: BackupFile
      /** Non-fatal problems worth reporting, e.g. records that were skipped. */
      warnings: string[]
    }
  | { ok: false; reason: BackupRejection; detail?: string }

/* ------------------------------------------------------------------ *
 *  Building a backup
 * ------------------------------------------------------------------ */

export interface BuildBackupInput {
  books: Book[]
  overrides: Record<string, Partial<Book>>
  notes: Note[]
  /** `idb:` reference -> portable asset, gathered by the caller. */
  assets: Map<string, BackupAsset>
  app: { name: string; version: string }
  exportedAt: string
}

/**
 * Assemble a backup document.
 *
 * `assets` maps the *original* `idb:` reference to a portable asset, so every
 * reference inside books, overrides and notes is rewritten in one pass. A
 * reference with no entry is dropped rather than left dangling, so the file can
 * never contain a link that cannot be resolved.
 */
export function buildBackup(input: BuildBackupInput): BackupFile {
  const byRef = new Map<string, string>()
  const assets: BackupAsset[] = []
  for (const [ref, asset] of input.assets) {
    byRef.set(ref, asset.key)
    assets.push(asset)
  }

  const rewrite = (ref: string | undefined): string | undefined =>
    ref ? byRef.get(ref) : undefined

  const books = input.books.map((book) => {
    const cover = rewrite(book.coverImage)
    return cover ? { ...book, coverImage: cover } : { ...book, coverImage: undefined }
  })

  const notes = input.notes.map((note) => {
    const image = rewrite(note.imageRef)
    return image ? { ...note, imageRef: image } : { ...note, imageRef: undefined }
  })

  // An override can carry a cover too (the user may re-upload a demo book's).
  const overrides: Record<string, Partial<Book>> = {}
  for (const [id, patch] of Object.entries(input.overrides)) {
    const cover = rewrite(patch.coverImage)
    overrides[id] = cover
      ? { ...patch, coverImage: cover }
      : { ...patch, coverImage: undefined }
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: { name: input.app.name, version: input.app.version },
    exportedAt: input.exportedAt,
    books,
    overrides,
    notes,
    assets,
  }
}

/**
 * Filename for the download, e.g. `Reading-Journal-backup-2026-03-15.json`.
 * Latin digits keep the name usable on filesystems that mangle non-ASCII.
 */
export function backupFilename(appName: string, isoDate: string): string {
  const slug = appName
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  const day = /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : 'export'
  return `${slug || 'reading-journal'}-backup-${day}${BACKUP_EXTENSION}`
}

/* ------------------------------------------------------------------ *
 *  Validation
 * ------------------------------------------------------------------ */

/** Keys that must never be copied onto an object, whatever a file contains. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, max = 20_000): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function isStatus(value: unknown): value is ReadingStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
}

function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && (NOTE_TYPES as readonly string[]).includes(value)
}

/** Finite number within range, else `undefined`. */
function optionalNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value < min || value > max) return undefined
  return value
}

/**
 * A parseable, plausible ISO-8601 instant, or `''`.
 *
 * Timestamps are validated rather than merely length-checked because every
 * downstream view sorts and groups by them. An unparseable value sorts to an
 * arbitrary position and renders as "Invalid Date"; a far-future one pins a book
 * to the top of "recently added" forever. Both come straight from a file the user
 * picked, so neither may be trusted.
 *
 * The accepted window runs from 1970 to 2100: wide enough for any real journal
 * entry, narrow enough to reject obvious nonsense.
 */
const MIN_TIMESTAMP = 0 // 1970-01-01T00:00:00Z
const MAX_TIMESTAMP = Date.UTC(2100, 0, 1)

function timestamp(value: unknown, max = 60): string {
  const raw = str(value, max)
  if (!raw) return ''

  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return ''
  if (parsed < MIN_TIMESTAMP || parsed >= MAX_TIMESTAMP) return ''

  // Re-serialise so downstream comparisons all see one canonical format
  // regardless of how the file happened to spell it.
  return new Date(parsed).toISOString()
}

/** `data:image/png;base64,....` with a plausible mime type and bounded payload. */
function parseDataUrl(
  value: unknown,
): { mimeType: string; dataUrl: string } | null {
  const raw = str(value, MAX_ASSET_BYTES * 2)
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(raw)
  if (!match) return null
  const mimeType = match[1].toLowerCase()
  // Only formats a browser can actually render in an <img>.
  if (!/^image\/(png|jpeg|jpg|gif|webp|avif|bmp|svg\+xml)$/.test(mimeType)) {
    return null
  }
  // ~4 base64 chars per 3 bytes; reject anything past the per-asset cap.
  if ((match[2]?.length ?? 0) > Math.ceil((MAX_ASSET_BYTES / 3) * 4) + 8) {
    return null
  }
  return { mimeType, dataUrl: raw }
}

/**
 * Validate a parsed backup document.
 *
 * Every field is re-derived rather than trusted, because valid JSON proves
 * nothing about the shape inside it. A record missing an id, a book id, or a
 * timestamp is dropped and counted in `warnings` instead of aborting the whole
 * file â€” one bad record should not cost the user the rest of their library, but
 * it is always reported.
 *
 * Notes pointing at a book absent from the file are still kept: that book may be
 * a bundled demo book this build ships. `planImport` counts them for the
 * preview and drops any that truly have no parent.
 */
export function validateBackup(input: unknown): ValidateResult {
  if (!isPlainObject(input)) return { ok: false, reason: 'not-an-object' }

  const version = input.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'missing-format' }
  }
  // A newer format may rely on fields this build cannot interpret.
  if (version > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'unsupported-version', detail: String(version) }
  }

  const warnings: string[] = []

  /* ---- assets ---- */
  const assets: BackupAsset[] = []
  const assetKeys = new Set<string>()
  for (const entry of Array.isArray(input.assets) ? input.assets : []) {
    if (!isPlainObject(entry)) continue
    const key = str(entry.key, 200)
    if (!key || FORBIDDEN_KEYS.has(key)) continue
    const parsed = parseDataUrl(entry.dataUrl)
    if (!parsed) {
      warnings.push('یک تصویر نامعتبر بود و کنار گذاشته شد.')
      continue
    }
    // A duplicate key would make references ambiguous; keep the first.
    if (assetKeys.has(key)) continue
    assetKeys.add(key)
    assets.push({ key, dataUrl: parsed.dataUrl, mimeType: parsed.mimeType })
  }

  /* ---- books ---- */
  const books: Book[] = []
  const bookIds = new Set<string>()
  let skippedBooks = 0

  for (const entry of Array.isArray(input.books) ? input.books : []) {
    if (!isPlainObject(entry)) {
      skippedBooks += 1
      continue
    }
    const id = str(entry.id, 200)
    const title = str(entry.title, 1000)
    const author = str(entry.author, 500)
    if (!id || !title || !author || FORBIDDEN_KEYS.has(id)) {
      skippedBooks += 1
      continue
    }
    if (bookIds.has(id)) {
      skippedBooks += 1
      continue
    }
    bookIds.add(id)

    // `coverImage` is only meaningful when it names an asset in this file.
    const cover = str(entry.coverImage, 200)
    books.push({
      id,
      title,
      author,
      translatedTitle: str(entry.translatedTitle, 500) || undefined,
      isbn: str(entry.isbn, 50) || undefined,
      genre: str(entry.genre, 200) || undefined,
      publishedYear: optionalNumber(entry.publishedYear, 0, 9999),
      status: isStatus(entry.status) ? entry.status : 'want-to-read',
      shelf: entry.shelf === 'reference' ? 'reference' : 'personal',
      progress: optionalNumber(entry.progress, 0, 1) ?? 0,
      totalPages: optionalNumber(entry.totalPages, 1, 1_000_000),
      currentPage: optionalNumber(entry.currentPage, 0, 1_000_000),
      coverImage: cover && assetKeys.has(cover) ? cover : undefined,
      lastAccessedAt: timestamp(entry.lastAccessedAt) || new Date(0).toISOString(),
      startedAt: timestamp(entry.startedAt) || undefined,
      finishedAt: timestamp(entry.finishedAt) || undefined,
      // Restored records are the user's own, never re-labelled as samples.
      origin: 'user',
    })
  }
  if (skippedBooks > 0) {
    warnings.push(`${skippedBooks} کتاب نامعتبر بود و وارد نشد.`)
  }

  /* ---- notes ---- */
  const notes: Note[] = []
  const noteIds = new Set<string>()
  let skippedNotes = 0

  for (const entry of Array.isArray(input.notes) ? input.notes : []) {
    if (!isPlainObject(entry)) {
      skippedNotes += 1
      continue
    }
    const id = str(entry.id, 200)
    const bookId = str(entry.bookId, 200)
    // A note without a usable creation time cannot be ordered at all, so it is
    // dropped rather than restored with a placeholder date.
    const createdAt = timestamp(entry.createdAt)
    if (!id || !bookId || !createdAt || FORBIDDEN_KEYS.has(id)) {
      skippedNotes += 1
      continue
    }
    if (noteIds.has(id)) {
      skippedNotes += 1
      continue
    }
    noteIds.add(id)

    const image = str(entry.imageRef, 200)
    const type = isNoteType(entry.type) ? entry.type : 'text'
    notes.push({
      id,
      bookId,
      // An `image` note whose asset did not survive becomes plain text rather
      // than a card with a permanently broken preview.
      type: type === 'image' && (!image || !assetKeys.has(image)) ? 'text' : type,
      content: str(entry.content, 50_000),
      page: optionalNumber(entry.page, 1, 100_000),
      imageRef: image && assetKeys.has(image) ? image : undefined,
      createdAt,
      updatedAt: timestamp(entry.updatedAt) || undefined,
    })
  }
  if (skippedNotes > 0) {
    warnings.push(`${skippedNotes} یادداشت نامعتبر بود و وارد نشد.`)
  }

  /* ---- overrides ---- */
  const overrides: Record<string, Partial<Book>> = {}
  if (isPlainObject(input.overrides)) {
    for (const [id, patch] of Object.entries(input.overrides)) {
      // Never assign to a prototype-polluting key, even from a nested object.
      if (!id || FORBIDDEN_KEYS.has(id) || !isPlainObject(patch)) continue

      const cover = str(patch.coverImage, 200)
      overrides[id] = {
        title: str(patch.title, 1000) || undefined,
        author: str(patch.author, 500) || undefined,
        translatedTitle: str(patch.translatedTitle, 500) || undefined,
        isbn: str(patch.isbn, 50) || undefined,
        genre: str(patch.genre, 200) || undefined,
        status: isStatus(patch.status) ? patch.status : undefined,
        progress: optionalNumber(patch.progress, 0, 1),
        totalPages: optionalNumber(patch.totalPages, 1, 1_000_000),
        currentPage: optionalNumber(patch.currentPage, 0, 1_000_000),
        coverImage: cover && assetKeys.has(cover) ? cover : undefined,
      }
    }
  }

  // A file with nothing in it is almost certainly not a backup. Treating it as
  // a valid empty library would let "replace" silently erase a real one.
  if (
    books.length === 0 &&
    notes.length === 0 &&
    Object.keys(overrides).length === 0
  ) {
    return { ok: false, reason: 'no-records' }
  }

  const app = isPlainObject(input.app) ? input.app : {}

  return {
    ok: true,
    backup: {
      formatVersion: BACKUP_FORMAT_VERSION,
      app: {
        name: str(app.name, 100) || 'Reading Journal',
        version: str(app.version, 40) || 'unknown',
      },
      exportedAt: timestamp(input.exportedAt) || new Date(0).toISOString(),
      books,
      overrides,
      notes,
      assets,
    },
    warnings,
  }
}

/**
 * Parse and validate raw file text.
 *
 * `JSON.parse` is the only step that can throw, and it is caught here so callers
 * always receive a typed result. The size check runs first: an enormous file
 * should be refused before the parser tries to build a string of it.
 */
export function parseBackup(text: string): ValidateResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: 'too-large' }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  return validateBackup(parsed)
}

/* ------------------------------------------------------------------ *
 *  Merge planning
 * ------------------------------------------------------------------ */

export type ImportStrategy = 'merge' | 'replace'

/** What a validated import contains, computed before anything is written. */
export interface ImportPreview {
  /** Records that will actually be added (merge) or written (replace). */
  books: number
  notes: number
  overrides: number
  assets: number
  /** Backup books whose id already exists locally â€” never overwritten on merge. */
  duplicateBookIds: string[]
  /** Backup notes whose id already exists locally. */
  duplicateNoteIds: string[]
  /**
   * Notes belonging to a bundled demo book rather than one in the file. They are
   * restorable, but the user should know why their book list will not grow.
   */
  notesForBundledBooks: number
}

export interface PlanInput {
  backup: BackupFile
  currentBooks: Book[]
  currentOverrides: Record<string, Partial<Book>>
  currentNotes: Note[]
  /** Ids of bundled demo books, which can never collide with user records. */
  demoBookIds: ReadonlySet<string>
  strategy: ImportStrategy
}

/** The exact records an import will write, computed before any storage write. */
export interface ImportPlan {
  strategy: ImportStrategy
  books: Book[]
  overrides: Record<string, Partial<Book>>
  notes: Note[]
  /** Backup asset key -> the local storage key it will be written under. */
  assetKeyMap: Map<string, string>
  preview: ImportPreview
}

/** Stable local id, avoiding `crypto` for parity with `useLibrary`. */
function localId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function planImport(input: PlanInput): ImportPlan {
  const { backup, currentBooks, currentNotes, strategy, demoBookIds } = input

  // Every asset gets a fresh key; the backup key only seeds the suffix so the
  // origin stays traceable in storage.
  const assetKeyMap = new Map<string, string>()
  for (const asset of backup.assets) {
    const suffix = asset.key.replace(/[^a-z0-9]/gi, '').slice(-12)
    assetKeyMap.set(asset.key, `${suffix ? `${suffix}-` : ''}${localId('img')}`)
  }

  const remapRef = (ref: string | undefined): string | undefined => {
    if (!ref) return undefined
    const local = assetKeyMap.get(ref)
    return local ? `idb:${local}` : undefined
  }

  if (strategy === 'replace') {
    // Only user-owned records are replaced. Demo books are code rather than
    // data and regenerate from the bundle, so they survive untouched.
    const books = backup.books.map((book) => {
      const cover = remapRef(book.coverImage)
      return cover ? { ...book, coverImage: cover } : { ...book, coverImage: undefined }
    })

    const overrides: Record<string, Partial<Book>> = {}
    for (const [id, patch] of Object.entries(backup.overrides)) {
      const cover = remapRef(patch.coverImage)
      overrides[id] = cover
        ? { ...patch, coverImage: cover }
        : { ...patch, coverImage: undefined }
    }

    const notes = backup.notes.map((note) => {
      const image = remapRef(note.imageRef)
      return image ? { ...note, imageRef: image } : { ...note, imageRef: undefined }
    })

    return {
      strategy,
      books,
      overrides,
      notes,
      assetKeyMap,
      preview: {
        books: books.length,
        notes: notes.length,
        overrides: Object.keys(overrides).length,
        assets: backup.assets.length,
        duplicateBookIds: [],
        duplicateNoteIds: [],
        notesForBundledBooks: 0,
      },
    }
  }

  /* ---------------------------- merge ---------------------------- */
  const existingBookIds = new Set(currentBooks.map((book) => book.id))
  const existingNoteIds = new Set(currentNotes.map((note) => note.id))
  // A note may legitimately point at a bundled demo book, whose id is not in
  // `currentBooks` because demo records are never stored.
  const knownBookIds = new Set([...existingBookIds, ...demoBookIds])

  const duplicateBookIds: string[] = []
  const duplicateNoteIds: string[] = []
  const bookIdRemap = new Map<string, string>()
  const addedBooks: Book[] = []

  for (const book of backup.books) {
    if (!existingBookIds.has(book.id)) {
      const cover = remapRef(book.coverImage)
      addedBooks.push(
        cover ? { ...book, coverImage: cover } : { ...book, coverImage: undefined },
      )
      continue
    }
    // Keep the local record; give the imported one its own identity so neither
    // side is lost. The new book is added immediately, which is what lets its
    // notes follow it below instead of dangling on the original id.
    duplicateBookIds.push(book.id)
    const freshId = localId('book')
    bookIdRemap.set(book.id, freshId)

    const cover = remapRef(book.coverImage)
    addedBooks.push(
      cover
        ? { ...book, id: freshId, coverImage: cover }
        : { ...book, id: freshId, coverImage: undefined },
    )
  }

  const books = [...currentBooks, ...addedBooks]

  // Re-keyed books are now part of the resulting library, so their notes count
  // as having a valid parent.
  for (const freshId of bookIdRemap.values()) knownBookIds.add(freshId)

  const addedNotes: Note[] = []
  let notesForBundledBooks = 0

  for (const note of backup.notes) {
    // Follow the book through any remap, so a note never points at a record
    // that was skipped, and drop it if the parent genuinely does not exist.
    const targetBook = bookIdRemap.get(note.bookId) ?? note.bookId
    if (!knownBookIds.has(targetBook)) continue

    const isDuplicate = existingNoteIds.has(note.id)
    if (isDuplicate) duplicateNoteIds.push(note.id)

    // A note on a bundled demo book is expected; count it so the preview can
    // explain why the book total and the note total need not match.
    if (demoBookIds.has(targetBook)) notesForBundledBooks += 1

    addedNotes.push({
      ...note,
      id: isDuplicate ? localId('note') : note.id,
      bookId: targetBook,
      imageRef: remapRef(note.imageRef),
    })
  }

  const notes = [...currentNotes, ...addedNotes]

  const overrides: Record<string, Partial<Book>> = { ...input.currentOverrides }
  for (const [id, patch] of Object.entries(backup.overrides)) {
    if (id in overrides) continue
    const cover = remapRef(patch.coverImage)
    overrides[id] = cover
      ? { ...patch, coverImage: cover }
      : { ...patch, coverImage: undefined }
  }

  return {
    strategy,
    books,
    overrides,
    notes,
    assetKeyMap,
    preview: {
      books: addedBooks.length,
      notes: addedNotes.length,
      overrides: Object.keys(backup.overrides).length,
      assets: backup.assets.length,
      duplicateBookIds,
      duplicateNoteIds,
      notesForBundledBooks,
    },
  }
}
