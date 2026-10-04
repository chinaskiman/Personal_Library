/**
 * ---------------------------------------------------------------------------
 *  ONE-TIME LIBRARY RESET
 * ---------------------------------------------------------------------------
 * The application used to ship eight invented sample books plus a fabricated
 * reading-activity panel, merged into every view on every load. No personal data
 * existed, so that content has been removed from the codebase entirely rather
 * than merely hidden — but anything already written to a previous install is
 * still sitting in that browser's storage.
 *
 * This module performs that cleanup exactly once. It is deliberately expressed
 * against an injected storage interface rather than `window` directly, so the
 * "runs once, never repeats, never touches anything else" rule can be tested
 * without a DOM.
 *
 * Guarantees:
 * - Only the keys handed in are removed. The theme key is never passed in, so an
 *   appearance preference survives untouched.
 * - A marker key records that it ran, so it cannot repeat or recreate anything.
 * - The metadata payload is rewritten as a valid, *empty* state rather than
 *   deleted, so the existing schema and its compatibility safeguards still apply.
 * ---------------------------------------------------------------------------
 */

/** Marker recording that the reset already happened. */
export const RESET_MARKER_KEY = 'reading-journal:reset-v1'

/** Value stored under the marker; bumped if a future cleanup ever needs to run. */
export const RESET_MARKER_VALUE = '1'

/**
 * The minimal storage surface used here.
 *
 * Matches both `Storage` and a plain in-memory stand-in, which is what makes the
 * rules below testable.
 */
export interface ResetStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** An empty library payload, written back so the schema stays valid. */
export const EMPTY_BOOKS_PAYLOAD = '{"books":[],"overrides":{}}'

/** An empty note list. */
export const EMPTY_NOTES_PAYLOAD = '[]'

export interface ResetInput {
  storage: ResetStorage
  /** Library payload key holding books and overrides. */
  booksKey: string
  /** Library payload key holding notes and quotes. */
  notesKey: string
  /** The schema-version key, rewritten to the current version after clearing. */
  versionKey: string
  /** Current schema version to stamp back after the reset. */
  schemaVersion: number
}

export interface ResetResult {
  /** True when this call performed the reset; false when it was already done. */
  performed: boolean
  /** Keys actually removed, for logging and tests. */
  removedKeys: string[]
}

/**
 * Run the one-time cleanup, including the image purge that belongs to it.
 *
 * This exists so the pairing of "clear the records" with "drop the images they
 * pointed at" lives in one guarded place. An earlier version called
 * `purgeAllImages()` from the boot script *outside* this guard, which meant every
 * page load deleted every cover and note image in the database while leaving the
 * `coverImage` references on the book records pointing at nothing. Binding the
 * purge to the `performed` result makes that mistake structurally impossible and
 * lets a test assert the purge does not run on later launches.
 *
 * The purge is async and therefore separated from the synchronous storage work.
 * It only happens on the single boot that actually clears the library; every
 * later boot returns before reaching it and never opens the image store.
 */
export async function runLibraryResetOnce(
  input: ResetInput,
  purgeImages: () => Promise<unknown>,
): Promise<ResetResult> {
  const result = resetLibraryOnce(input)

  // The decisive check: on every subsequent launch this is false and the image
  // store is never opened at all.
  if (!result.performed) return result

  try {
    await purgeImages()
  } catch {
    // A failed purge is not fatal. The records that referenced these images have
    // already been cleared, so the worst case is a few unreferenced blobs — which
    // cost storage quota, not correctness.
  }

  return result
}

/**
 * Clear stored library data exactly once.
 *
 * The marker is written *first*: if the process is interrupted between removing
 * the data and recording the fact, the next load will not try again and will not
 * recreate anything — it simply starts empty, because the keys are already gone.
 * The reverse order would risk a partially-failed cleanup being retried forever.
 *
 * Never throws: a browser with storage disabled must still render the app.
 */
export function resetLibraryOnce(input: ResetInput): ResetResult {
  const { storage, booksKey, notesKey, versionKey, schemaVersion } = input

  try {
    if (storage.getItem(RESET_MARKER_KEY) === RESET_MARKER_VALUE) {
      return { performed: false, removedKeys: [] }
    }

    // Marker written before any removal — see the note above.
    storage.setItem(RESET_MARKER_KEY, RESET_MARKER_VALUE)

    const removedKeys: string[] = []
    for (const key of [booksKey, notesKey, versionKey]) {
      storage.removeItem(key)
      removedKeys.push(key)
    }

    // Re-seed a valid, *empty* state rather than leaving the keys absent: the app
    // writes this exact shape on every save, so it must round-trip through the
    // existing schema and its compatibility safeguards.
    storage.setItem(versionKey, String(schemaVersion))
    storage.setItem(booksKey, EMPTY_BOOKS_PAYLOAD)
    storage.setItem(notesKey, EMPTY_NOTES_PAYLOAD)

    return { performed: true, removedKeys }
  } catch {
    // Storage unavailable or refused: nothing to clear, and nothing to do about
    // it. The app still starts with an empty in-memory library.
    return { performed: false, removedKeys: [] }
  }
}