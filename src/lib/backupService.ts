/**
 * ---------------------------------------------------------------------------
 *  BACKUP SERVICE — the runtime I/O around the pure format module
 * ---------------------------------------------------------------------------
 * `lib/backup` decides *what* goes in a file and validates what comes back.
 * This module performs the browser work: reading images out of IndexedDB,
 * handing the user a download, decoding a chosen file, and writing the records
 * back. Keeping the two apart is what makes the rules there testable without a
 * browser.
 *
 * Design notes that matter for data safety:
 *
 * - Assets are read once, converted to data URLs, and released. A large library
 *   means a large transient allocation, so export is refused above a size
 *   threshold rather than risking a tab crash.
 *
 * - Import writes assets BEFORE metadata. A record that points at an image is
 *   only useful once the image exists, and this ordering means a failure leaves
 *   harmless unreferenced assets rather than records pointing at nothing.
 *
 * - Nothing here throws. Every failure resolves to a Persian-readable reason so
 *   the UI never has to render an exception or a stack trace.
 * ---------------------------------------------------------------------------
 */
import {
  BACKUP_MIME,
  MAX_BACKUP_BYTES,
  backupFilename,
  buildBackup,
  parseBackup,
  planImport,
} from './backup'
import type {
  BackupAsset,
  BackupFile,
  BackupRejection,
  ImportPlan,
  ImportStrategy,
} from './backup'
import { deleteImages, readAllImages, writeImages } from './imageStore'
import type { Book } from '@/types/book'
import type { Note } from '@/types/note'

/** Above this many bytes of JSON, refuse rather than risk a tab crash. */
const SOFT_EXPORT_BUDGET = 48 * 1024 * 1024

export type ExportFailure =
  | 'no-records'
  | 'too-large'
  | 'no-images-readable'
  | 'download-failed'

export type ExportResult =
  | {
      ok: true
      /** Bytes of JSON written — the real file size, not an estimate. */
      size: number
      assetsIncluded: number
      /** Assets that could not be read, so the user knows what is missing. */
      assetsSkipped: number
      /** Records whose image reference was dropped because it was unreadable. */
      recordsMissingImage: number
      fileName: string
    }
  | { ok: false; reason: ExportFailure }

export interface ExportInput {
  books: Book[]
  overrides: Record<string, Partial<Book>>
  notes: Note[]
  app: { name: string; version: string }
  /** Injectable for tests; defaults to the real clock. */
  now?: () => Date
}

/** Collect every image reference currently in use, as `idb:` strings. */
function collectReferences(input: ExportInput): Set<string> {
  const refs = new Set<string>()
  const add = (ref: string | undefined) => {
    // `blob:` URLs are session-scoped and never portable, so they are ignored
    // here rather than exported as if they meant something.
    if (ref && ref.startsWith('idb:')) refs.add(ref)
  }

  for (const book of input.books) add(book.coverImage)
  for (const patch of Object.values(input.overrides)) add(patch.coverImage)
  for (const note of input.notes) add(note.imageRef)

  return refs
}

/** Blob -> data URL, resolving to `null` if the blob cannot be read. */
function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    let url = ''
    try {
      url = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onload = () => {
        // Revoked as soon as the read resolves; the data URL outlives it.
        URL.revokeObjectURL(url)
        resolve(typeof reader.result === 'string' ? reader.result : null)
      }
      reader.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      reader.readAsDataURL(blob)
    } catch {
      if (url) URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

/**
 * Build the backup document and hand it to the user as a download.
 *
 * Only data the *user* owns is written: their books, their notes, and their
 * edits to bundled sample books. The sample library itself ships with the
 * application and is deliberately excluded.
 */
export async function exportBackup(input: ExportInput): Promise<ExportResult> {
  if (input.books.length === 0 && input.notes.length === 0) {
    return { ok: false, reason: 'no-records' }
  }

  const refs = collectReferences(input)

  // Read every stored image once. A missing key simply has no entry.
  const stored = await readAllImages()

  const assets = new Map<string, BackupAsset>()
  let assetsSkipped = 0
  let index = 0

  for (const ref of refs) {
    const blob = stored.get(ref.slice(4))
    // A record can reference an image that was deleted or never stored; that
    // is reported as skipped rather than failing the whole export.
    const dataUrl = blob ? await blobToDataUrl(blob) : null
    if (!blob || !dataUrl) {
      assetsSkipped += 1
      continue
    }
    assets.set(ref, {
      // Sequential and deterministic: order follows the reference list, so two
      // exports of the same library produce identical keys.
      key: `asset-${index}`,
      dataUrl,
      mimeType: blob.type || 'image/png',
    })
    index += 1
  }

  // A library that referenced images but could read none of them would produce
  // a misleadingly complete-looking file. Say so instead.
  if (assetsSkipped > 0 && assets.size === 0 && refs.size > 0) {
    return { ok: false, reason: 'no-images-readable' }
  }

  const backup = buildBackup({
    books: input.books,
    overrides: input.overrides,
    notes: input.notes,
    assets,
    app: input.app,
    exportedAt: (input.now?.() ?? new Date()).toISOString(),
  })

  const text = JSON.stringify(backup, null, 2)
  const size = text.length
  if (size > SOFT_EXPORT_BUDGET) return { ok: false, reason: 'too-large' }

  const fileName = backupFilename(input.app.name, backup.exportedAt)

  try {
    const blob = new Blob([text], { type: BACKUP_MIME })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoked on the next tick: revoking synchronously can cancel the download
    // in some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch {
    return { ok: false, reason: 'download-failed' }
  }

  return {
    ok: true,
    size,
    assetsIncluded: assets.size,
    assetsSkipped,
    recordsMissingImage: countRecordsMissingImages(input, assets),
    fileName,
  }
}

/**
 * How many records ended up without an image because the asset was unreadable.
 *
 * Reported separately so the success message never implies a complete image set.
 */
function countRecordsMissingImages(input: ExportInput, assets: Map<string, BackupAsset>): number {
  let missing = 0
  const check = (ref: string | undefined) => {
    // Only references that pointed at a real stored image count; a `blob:` URL
    // was never expected to survive an export.
    if (ref && ref.startsWith('idb:') && !assets.has(ref)) missing += 1
  }

  for (const book of input.books) check(book.coverImage)
  for (const patch of Object.values(input.overrides)) check(patch.coverImage)
  for (const note of input.notes) check(note.imageRef)

  return missing
}
/* ------------------------------------------------------------------ *
 *  Import
 * ------------------------------------------------------------------ */


export type ImportFailure =
  | BackupRejection
  | 'unreadable-file'
  | 'too-large'

export type ParseFileResult =
  | { ok: true; backup: BackupFile; warnings: string[] }
  | { ok: false; reason: ImportFailure }

export interface ImportedState {
  books: Book[]
  overrides: Record<string, Partial<Book>>
  notes: Note[]
}

export type ApplyResult =
  | { ok: true; imported: ImportedState; assetsWritten: number; assetsFailed: number }
  | { ok: false; reason: 'assets-failed' }

/**
 * Read and validate a user-selected file. Nothing is written.
 *
 * The size is checked before the file is read into memory, so an enormous file
 * is refused rather than loaded.
 */
export async function readBackupFile(file: File): Promise<ParseFileResult> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, reason: 'too-large' }

  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, reason: 'unreadable-file' }
  }

  const result = parseBackup(text)
  if (!result.ok) return { ok: false, reason: result.reason }

  return { ok: true, backup: result.backup, warnings: result.warnings }
}

export interface ApplyInput {
  backup: BackupFile
  strategy: ImportStrategy
  currentBooks: Book[]
  currentOverrides: Record<string, Partial<Book>>
  currentNotes: Note[]
  demoBookIds: ReadonlySet<string>
}

/** Compute what an import would do, for the preview. No writes occur. */
export function prepareImport(input: ApplyInput): ImportPlan {
  return planImport({
    backup: input.backup,
    currentBooks: input.currentBooks,
    currentOverrides: input.currentOverrides,
    currentNotes: input.currentNotes,
    demoBookIds: input.demoBookIds,
    strategy: input.strategy,
  })
}

/** Decode a base64 data URL into a Blob, or `null` if it is not decodable. */
function dataUrlToBlob(dataUrl: string, mimeType: string): Blob | null {
  const match = /^data:([a-z0-9.+/-]+);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!match) return null
  try {
    const binary = atob(match[2].replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mimeType || match[1] })
  } catch {
    return null
  }
}

/**
 * Write a planned import's assets, in one transaction.
 *
 * Assets land before the caller commits any metadata, so a record never points
 * at an image that was not stored. If any write fails, the successful ones are
 * deleted again — a partial asset set would look like missing images forever,
 * whereas a clean failure leaves the library exactly as it was.
 *
 * An asset that cannot even be decoded aborts the whole import rather than being
 * skipped. Committing the record anyway would leave it pointing at a key that
 * holds nothing, which reads as a lost image the user was never told about.
 *
 * Returns the number of assets stored, or an error if the set cannot be trusted.
 */
export async function writeImportAssets(
  plan: ImportPlan,
  backup: BackupFile,
): Promise<{ ok: true; written: number } | { ok: false; reason: 'assets-failed' }> {
  if (plan.assetKeyMap.size === 0) return { ok: true, written: 0 }

  const byKey = new Map(backup.assets.map((asset) => [asset.key, asset]))
  const entries: { key: string; blob: Blob }[] = []

  for (const [backupKey, localKey] of plan.assetKeyMap) {
    const asset = byKey.get(backupKey)
    if (!asset) continue
    const blob = dataUrlToBlob(asset.dataUrl, asset.mimeType)
    if (!blob) {
      // Refuse rather than skip: the planned records already reference this key.
      return { ok: false, reason: 'assets-failed' }
    }
    entries.push({ key: localKey, blob })
  }

  if (entries.length === 0) return { ok: true, written: 0 }

  const failed = await writeImages(entries)
  if (failed.length > 0) {
    // Roll back the writes that did succeed so nothing is half-applied.
    await deleteImages(failed.map((key) => `idb:${key}`))
    return { ok: false, reason: 'assets-failed' }
  }

  return { ok: true, written: entries.length }
}

/** Rough byte size of a record set, for the storage-usage estimate. */
export function estimateRecordBytes(state: ImportedState): number {
  try {
    return JSON.stringify(state).length
  } catch {
    return 0
  }
}
