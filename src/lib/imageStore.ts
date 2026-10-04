/**
 * Image blob store, backed by IndexedDB.
 *
 * Cover and journal images are kept out of `localStorage` on purpose: a base64
 * data URL for a single photo would blow through the ~5 MB quota almost
 * immediately. IndexedDB stores the original `Blob` so the bytes stay identical
 * and cost nothing extra to encode.
 *
 * Records are referenced from persisted metadata as `idb:<key>`. Object URLs
 * are minted only at render time and revoked on unmount — they are never
 * persisted, because they are meaningless after a reload.
 *
 * Every operation resolves rather than rejects, so a browser with IndexedDB
 * disabled degrades to "no image" instead of breaking the page.
 */
const DB_NAME = 'reading-journal'
const DB_VERSION = 1
const STORE = 'images'

/** Marks a string as a reference into this store. */
export const IMAGE_REF_PREFIX = 'idb:'

/** True when a string is a reference this module can resolve. */
export function isImageRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(IMAGE_REF_PREFIX)
}

/** Wrap a storage key as a persistable reference. */
export function toImageRef(key: string): string {
  return `${IMAGE_REF_PREFIX}${key}`
}

/** Recover the storage key from a reference. */
export function imageRefKey(ref: string): string {
  return ref.slice(IMAGE_REF_PREFIX.length)
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/**
 * Open (and memoize) the database.
 *
 * Resolves to `null` when IndexedDB is unavailable — private browsing on some
 * browsers, disabled site data, or an older engine — which callers treat as
 * "images cannot be stored".
 */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    // A blocked upgrade must not hang the caller forever.
    request.onblocked = () => resolve(null)
  })

  return dbPromise
}

/** Run a transaction, resolving `undefined` if anything is unavailable. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const db = await openDb()
  if (!db) return undefined

  return new Promise<T | undefined>((resolve) => {
    let request: IDBRequest<T>
    try {
      const tx = db.transaction(STORE, mode)
      request = run(tx.objectStore(STORE))
    } catch {
      resolve(undefined)
      return
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(undefined)
  })
}

/**
 * Persist a file and return its reference, or `undefined` if it could not be
 * stored. Callers must treat `undefined` as "save without an image" and tell
 * the user, rather than assuming success.
 */
export async function saveImage(file: Blob): Promise<string | undefined> {
  const key = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

  const stored = await withStore('readwrite', (store) => store.put(file, key))
  return stored === undefined ? undefined : toImageRef(key)
}

/** Read a blob back by reference. `undefined` when missing or unreadable. */
export async function getImageBlob(ref: string): Promise<Blob | undefined> {
  if (!isImageRef(ref)) return undefined
  const blob = await withStore<Blob>('readonly', (store) =>
    store.get(imageRefKey(ref)),
  )
  return blob ?? undefined
}

/** Remove a stored image. Missing entries are not an error. */
export async function deleteImage(ref: string): Promise<void> {
  if (!isImageRef(ref)) return
  await withStore('readwrite', (store) => store.delete(imageRefKey(ref)))
}

/** Remove many images, ignoring individual failures. */
export async function deleteImages(refs: string[]): Promise<void> {
  await Promise.all(refs.filter(isImageRef).map((ref) => deleteImage(ref)))
}

/** Keys of every stored image, for the storage-usage estimate and export. */
export async function listImageKeys(): Promise<string[]> {
  return (
    (await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys())) ?? []
  ).map((key) => String(key))
}

/**
 * Delete stored images that nothing references any more.
 *
 * Called only *after* a replacement of user records has been committed: the new
 * records no longer point at the old images, so removing them cannot break
 * anything still on screen. Ordering matters — pruning first would leave live
 * records pointing at keys that had just been deleted.
 *
 * Deliberately silent about failures: an orphaned image wastes a little space,
 * whereas refusing to finish a restore over one would be the worse trade.
 */
export async function pruneUnreferencedImages(referencedRefs: Iterable<string>): Promise<number> {
  const keep = new Set<string>()
  for (const ref of referencedRefs) {
    if (isImageRef(ref)) keep.add(imageRefKey(ref))
  }

  const keys = await listImageKeys()
  const orphans = keys.filter((key) => !keep.has(key))
  if (orphans.length === 0) return 0

  await deleteImages(orphans.map(toImageRef))
  return orphans.length
}

/**
 * Delete every stored image.
 *
 * Used by the one-time library reset: covers and note images belong to the
 * library, so removing them alongside the records that reference them is what
 * stops orphaned blobs being counted against the storage quota forever.
 *
 * Resolves rather than rejects when IndexedDB is unavailable, matching every
 * other function here — a browser with no image store simply has nothing to
 * purge.
 */
export async function purgeAllImages(): Promise<number> {
  const keys = await listImageKeys()
  if (keys.length === 0) return 0
  await deleteImages(keys.map(toImageRef))
  return keys.length
}

/**
 * Read every stored image, for backup export.
 *
 * Returned as a `Map` of key to `Blob`. A missing database or an unreadable
 * record yields an absent entry rather than a rejection, so the caller can
 * report exactly which assets were skipped instead of failing the whole export.
 */
export async function readAllImages(): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>()
  const db = await openDb()
  if (!db) return result

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }

    try {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const keys = store.getAllKeys()
      const blobs = store.getAll()

      tx.oncomplete = () => {
        // Both requests resolved; the transaction guarantees both are done.
        keys.result.forEach((key, index) => {
          const blob = blobs.result[index]
          if (blob instanceof Blob) result.set(String(key), blob)
        })
        finish()
      }
      tx.onerror = finish
      tx.onabort = finish
    } catch {
      finish()
    }
  })

  return result
}

/**
 * Write many images in a single transaction.
 *
 * One transaction means a partial write cannot leave half the assets stored,
 * which matters when the metadata pointing at them is already being replaced.
 * Returns the keys that could not be written so the caller can report them
 * rather than claiming a complete restore.
 */
export async function writeImages(
  entries: readonly { key: string; blob: Blob }[],
): Promise<string[]> {
  if (entries.length === 0) return []

  const failed: string[] = []
  const db = await openDb()
  if (!db) return entries.map((entry) => entry.key)

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }

    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const entry of entries) {
        try {
          const request = store.put(entry.blob, entry.key)
          request.onerror = () => failed.push(entry.key)
        } catch {
          failed.push(entry.key)
        }
      }
      tx.oncomplete = finish
      tx.onerror = finish
      tx.onabort = finish
    } catch {
      entries.forEach((entry) => failed.push(entry.key))
      finish()
    }
  })

  return failed
}