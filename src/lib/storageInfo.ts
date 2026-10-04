/**
 * ---------------------------------------------------------------------------
 *  STORAGE INFORMATION
 * ---------------------------------------------------------------------------
 * Everything reported on the Settings page about local storage.
 *
 * The guiding rule is that an estimate must never be presented as a fact. A
 * browser may refuse to reveal how much space is left, may evict local data at
 * any time, and gives no guarantee that anything here survives. So the module
 * returns *what can actually be measured* and leaves the rest `undefined` — the
 * page then explains the gap in Persian rather than printing a number that
 * might mislead.
 * ---------------------------------------------------------------------------
 */
import { isStorageAvailable } from './storage.ts'
import { listImageKeys } from './imageStore.ts'
import type { Book } from '../types/book.ts'
import type { Note } from '../types/note.ts'

export interface StorageEstimate {
  /** Whether localStorage can be written at all. */
  available: boolean
  /** Approximate bytes of JSON records; images are counted separately. */
  recordsBytes: number
  /** Number of stored image assets. */
  imageCount: number
  /** Bytes used / total, when the browser exposes the Storage API. */
  usageBytes?: number
  quotaBytes?: number
  /** True when neither storage backend could be reached at all. */
  imageStoreUnavailable?: boolean
}

/**
 * Ask the browser for its storage usage, if it will say.
 *
 * The Storage API is not universally available and can reject, so failure is a
 * normal outcome reported as "unknown" rather than an error.
 */
async function readQuota(): Promise<{ usageBytes?: number; quotaBytes?: number }> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return {}
    const estimate = await navigator.storage.estimate()
    return {
      usageBytes: typeof estimate.usage === 'number' ? estimate.usage : undefined,
      quotaBytes: typeof estimate.quota === 'number' ? estimate.quota : undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Measure what is stored.
 *
 * Sizes are computed by serialising the records, which is an approximation:
 * the browser may compress or pad what it stores. It is the closest honest
 * figure available without asking the browser for exact internals.
 */
export async function measureStorage(
  books: readonly Book[],
  notes: readonly Note[],
): Promise<StorageEstimate> {
  const available = isStorageAvailable()

  let recordsBytes = 0
  try {
    // Only user-owned records are serialised: sample books ship with the app and
    // are not part of the user's stored data.
    recordsBytes = JSON.stringify({ books, notes }).length
  } catch {
    recordsBytes = 0
  }

  let imageCount = 0
  let imageStoreUnavailable = false
  try {
    imageCount = (await listImageKeys()).length
  } catch {
    // An unreachable IndexedDB does not mean no images; it means we cannot say.
    imageStoreUnavailable = true
  }

  return { available, recordsBytes, imageCount, imageStoreUnavailable, ...(await readQuota()) }
}