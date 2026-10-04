/**
 * Every key is namespaced so the app never collides with anything else on the
 * same origin, and so a stale key can be identified and cleaned up during a
 * migration.
 */
const KEY_PREFIX = 'reading-journal:'

/**
 * Result of a guarded storage write. Callers surface `ok: false` to the user
 * rather than throwing, so a full or disabled store degrades to in-memory
 * behaviour instead of breaking the screen.
 */
export interface StorageWriteResult {
  ok: boolean
  error?: StorageErrorKind
}

export type StorageErrorKind = 'unavailable' | 'quota' | 'malformed'

/**
 * Read and parse a JSON value.
 *
 * Never throws: unavailable storage, missing keys and malformed JSON all
 * resolve to `fallback`, because a corrupt entry should degrade to "no saved
 * data" rather than take the application down.
 */
export function readJson<T>(key: string, fallback: T): T {
  const store = getStore()
  if (!store) return fallback

  try {
    const raw = store.getItem(key)
    if (raw === null) return fallback

    const parsed = JSON.parse(raw) as unknown
    if (parsed === null) return fallback

    // Compare against the *fallback's* type rather than demanding an object:
    // some keys hold scalars (the schema version is a number), and rejecting
    // those would silently discard valid stored data.
    if (typeof parsed !== typeof fallback) return fallback

    return parsed as T
  } catch {
    // Malformed JSON, or a storage implementation that throws on read
    // (private mode, disabled cookies). Treat as "nothing saved yet".
    return fallback
  }
}

/** Write a JSON value, reporting failure instead of throwing. */
export function writeJson(key: string, value: unknown): StorageWriteResult {
  const store = getStore()
  if (!store) return { ok: false, error: 'unavailable' }

  try {
    store.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (error) {
    // QuotaExceededError is the common case here; anything else is treated
    // generically since DOMException subclasses are not available everywhere.
    const name = error instanceof Error ? error.name : ''
    return { ok: false, error: name === 'QuotaExceededError' ? 'quota' : 'unavailable' }
  }
}

/** Remove a key. Never throws. */
export function removeKey(key: string): void {
  try {
    getStore()?.removeItem(key)
  } catch {
    /* nothing useful to do if removal fails */
  }
}

/** True when persistent storage can be written to. */
export function isStorageAvailable(): boolean {
  const store = getStore()
  if (!store) return false

  const probe = `${KEY_PREFIX}__probe__`
  try {
    store.setItem(probe, '1')
    store.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve `localStorage` lazily.
 *
 * Accessing `window.localStorage` itself throws in some privacy modes, so the
 * lookup is wrapped rather than assumed.
 */
function getStore(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}