// ---------------------------------------------------------------------------
//  IMAGE PURGE CHECK
// ---------------------------------------------------------------------------
// The cleanup must also remove stored covers and note images, not just the
// records referencing them. This seeds the app's own IndexedDB store, reloads,
// and confirms the blobs are gone.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node ui-images.mjs
// ---------------------------------------------------------------------------
import { launch } from './theme-cdp.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms))

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
}

/** Counts the entries in the app's image object store, via the page's own API. */
const COUNT_IMAGES = `(async () => {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('reading-journal', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('blocked'))
  })
  try {
    const db = await open()
    if (!db.objectStoreNames.contains('images')) return 0
    const tx = db.transaction('images', 'readonly')
    const store = tx.objectStore('images')
    return await new Promise((resolve, reject) => {
      const req = store.count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return 0
  }
})()`

/** Writes three placeholder images into the store, as a previous install would. */
const SEED_IMAGES = `(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('reading-journal', 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('images')) req.result.createObjectStore('images')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const blob = new Blob(['fake-image-bytes'], { type: 'image/png' })
  await new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite')
    const store = tx.objectStore('images')
    for (const key of ['cover-1', 'cover-2', 'note-1']) store.put(blob, key)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  return true
})()`

const page = await launch({ prefersDark: false })
try {
  await page.goto(BASE)
  await page.eval(`localStorage.clear()`)
  await page.reload()
  await settle(500)

  console.log('--- seed stored images, as a previous install would have ---')
  await page.eval(SEED_IMAGES)
  check('images present before the reset', await page.eval(COUNT_IMAGES), 3)

  console.log('--- clear the reset marker and reload ---')
  await page.eval(`localStorage.removeItem('reading-journal:reset-v1')`)
  await page.reload()
  await settle(800)

  check('images removed by the cleanup', await page.eval(COUNT_IMAGES), 0)
  check('reset marker rewritten', await page.eval(`localStorage.getItem('reading-journal:reset-v1')`), '1')

  console.log('--- the store stays empty across further reloads ---')
  await page.reload()
  await settle(700)
  check('still no images', await page.eval(COUNT_IMAGES), 0)
} finally {
  await page.close()
}

console.log(failed === 0 ? '\nIMAGE PURGE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1