import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EMPTY_BOOKS_PAYLOAD,
  EMPTY_NOTES_PAYLOAD,
  RESET_MARKER_KEY,
  resetLibraryOnce,
  runLibraryResetOnce,
  type ResetStorage,
} from './libraryReset.ts'

const BOOKS = 'reading-journal:books'
const NOTES = 'reading-journal:notes'
const VERSION = 'reading-journal:version'
const THEME = 'reading-journal:theme'

/** In-memory stand-in for `localStorage`, seeded with the given entries. */
function fakeStorage(seed: Record<string, string> = {}): ResetStorage & {
  store: Map<string, string>
} {
  const store = new Map(Object.entries(seed))
  return {
    store,
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  }
}

/** A previous install: sample books, notes, and a chosen theme. */
function seededOldInstall(): ReturnType<typeof fakeStorage> {
  return fakeStorage({
    [BOOKS]: JSON.stringify({
      books: [
        { id: 'demo-1', title: 'The Remains of the Day', origin: 'demo' },
        { id: 'demo-2', title: 'Invisible Cities', origin: 'demo' },
      ],
      overrides: { 'demo-1': { progress: 0.6 } },
    }),
    [NOTES]: JSON.stringify([
      { id: 'n1', bookId: 'demo-1', type: 'text', content: 'یادداشت نمونه' },
    ]),
    [VERSION]: '1',
    [THEME]: 'dark',
  })
}

const input = (storage: ResetStorage) => ({
  storage,
  booksKey: BOOKS,
  notesKey: NOTES,
  versionKey: VERSION,
  schemaVersion: 1,
})

describe('resetLibraryOnce', () => {
  it('removes stored books, notes and the schema version', () => {
    const storage = seededOldInstall()

    const result = resetLibraryOnce(input(storage))

    assert.equal(result.performed, true)
    assert.deepEqual(result.removedKeys, [BOOKS, NOTES, VERSION])
  })

  it('leaves the library empty and valid, not merely absent', () => {
    const storage = seededOldInstall()

    resetLibraryOnce(input(storage))

    // Absent keys would read as a corrupt or missing install. The app must come
    // back with a well-formed empty state it can round-trip through the schema.
    assert.deepEqual(JSON.parse(storage.store.get(BOOKS) as string), {
      books: [],
      overrides: {},
    })
    assert.deepEqual(JSON.parse(storage.store.get(NOTES) as string), [])
    assert.equal(storage.store.get(BOOKS), EMPTY_BOOKS_PAYLOAD)
    assert.equal(storage.store.get(NOTES), EMPTY_NOTES_PAYLOAD)
    assert.equal(storage.store.get(VERSION), '1')
  })

  it('preserves the theme preference', () => {
    const storage = seededOldInstall()
    assert.equal(storage.store.get(THEME), 'dark')

    resetLibraryOnce(input(storage))

    // The theme key is not passed in, so it cannot be touched.
    assert.equal(storage.store.get(THEME), 'dark')
  })

  it('leaves unrelated storage on the origin alone', () => {
    const storage = seededOldInstall()
    storage.store.set('some-other-app:token', 'keep-me')

    resetLibraryOnce(input(storage))

    assert.equal(storage.store.get('some-other-app:token'), 'keep-me')
  })

  it('records a marker so it never runs twice', () => {
    const storage = seededOldInstall()

    resetLibraryOnce(input(storage))
    assert.equal(storage.store.get(RESET_MARKER_KEY), '1')

    // A later visit must not clear anything the user has since added.
    storage.store.set(BOOKS, JSON.stringify({ books: [{ id: 'b9' }], overrides: {} }))
    storage.store.set(NOTES, JSON.stringify([{ id: 'n9' }]))

    const second = resetLibraryOnce(input(storage))

    assert.equal(second.performed, false)
    assert.deepEqual(second.removedKeys, [])
    assert.equal(storage.store.get(BOOKS), JSON.stringify({ books: [{ id: 'b9' }], overrides: {} }))
    assert.equal(storage.store.get(NOTES), JSON.stringify([{ id: 'n9' }]))
  })

  it('runs on a completely empty store and still seeds the schema', () => {
    const storage = fakeStorage()

    const result = resetLibraryOnce(input(storage))

    assert.equal(result.performed, true)
    assert.equal(storage.store.get(BOOKS), EMPTY_BOOKS_PAYLOAD)
    assert.equal(storage.store.get(NOTES), EMPTY_NOTES_PAYLOAD)
  })

  it('never resurrects anything: the reset only ever writes empty state', () => {
    const storage = seededOldInstall()

    resetLibraryOnce(input(storage))

    const books = JSON.parse(storage.store.get(BOOKS) as string)
    const notes = JSON.parse(storage.store.get(NOTES) as string)
    assert.deepEqual(books.books, [])
    assert.deepEqual(books.overrides, {})
    assert.deepEqual(notes, [])
  })

  it('reports failure instead of throwing when storage refuses', () => {
    const storage: ResetStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }

    const result = resetLibraryOnce(input(storage))

    // A browser with storage disabled must still render the app.
    assert.equal(result.performed, false)
    assert.deepEqual(result.removedKeys, [])
  })

  it('marks the reset before removing anything, so a failure cannot loop', () => {
    const store = new Map<string, string>(Object.entries({ [BOOKS]: '{"books":[{}]}' }))
    const storage: ResetStorage = {
      getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key, value) => void store.set(key, value),
      removeItem: () => {
        throw new Error('quota exceeded')
      },
    }

    resetLibraryOnce(input(storage))

    // The marker is already in place, so the next load starts clean instead of
    // retrying forever.
    assert.equal(store.get(RESET_MARKER_KEY), '1')
  })
})

/**
 * Regression cover for the reported bug: uploaded cover images vanished after a
 * restart because the boot script purged the image store unconditionally, outside
 * the once-only guard. Every page load deleted every blob while the books kept
 * their `coverImage` references.
 */
describe('runLibraryResetOnce — image purge is bound to the reset', () => {
  it('purges images on the one launch that clears the library', async () => {
    const storage = seededOldInstall()
    let purged = 0

    const result = await runLibraryResetOnce(input(storage), async () => {
      purged += 1
      return 1
    })

    assert.equal(result.performed, true)
    assert.equal(purged, 1)
  })

  it('never opens the image store on any later launch', async () => {
    const storage = seededOldInstall()
    let purged = 0
    const purge = async () => {
      purged += 1
    }

    // First launch performs the reset and may purge.
    await runLibraryResetOnce(input(storage), purge)
    assert.equal(purged, 1)

    // The user uploads a cover; later launches must not touch that image.
    storage.store.set(BOOKS, JSON.stringify({ books: [{ id: 'b1', coverImage: 'idb:img-1' }], overrides: {} }))

    for (let launch = 0; launch < 5; launch += 1) {
      const result = await runLibraryResetOnce(input(storage), purge)
      assert.equal(result.performed, false)
    }

    // The cover reference is still exactly where the user left it.
    assert.equal(purged, 1, 'image store must be purged exactly once, ever')
    assert.equal(
      storage.store.get(BOOKS),
      JSON.stringify({ books: [{ id: 'b1', coverImage: 'idb:img-1' }], overrides: {} }),
    )
  })

  it('leaves library data alone when storage is unavailable', async () => {
    let purged = 0
    const blocked: ResetStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }

    const result = await runLibraryResetOnce(input(blocked), async () => {
      purged += 1
    })

    assert.equal(result.performed, false)
    assert.equal(purged, 0)
  })

  it('still reports success when the purge itself fails', async () => {
    const storage = seededOldInstall()

    const result = await runLibraryResetOnce(input(storage), async () => {
      throw new Error('IndexedDB unavailable')
    })

    // The records are already cleared; unreferenced blobs are the only residue.
    assert.equal(result.performed, true)
    assert.equal(storage.store.get(BOOKS), EMPTY_BOOKS_PAYLOAD)
    assert.equal(storage.store.get(NOTES), EMPTY_NOTES_PAYLOAD)
  })
})