// ---------------------------------------------------------------------------
//  DEV-SERVER RESTART PERSISTENCE CHECK
// ---------------------------------------------------------------------------
// Reproduces the reported scenario end to end, controlling the dev server's
// lifecycle itself:
//
//   start dev -> add a book with a real uploaded cover -> reload
//     -> STOP dev server -> START dev server on the same port -> reload
//     -> assert the same book, the same image id, and a rendered image
//
// The Chrome profile is created once and kept alive across the restart, so the
// IndexedDB written before the restart is the one read back afterwards. Nothing
// is cleared as part of the test apart from the one-time cleanup on first load.
//
//   node ui-restart.mjs
// ---------------------------------------------------------------------------
import { spawn } from 'node:child_process'
import { launch } from './theme-cdp.mjs'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms))

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
}
const report = (label, value) => console.log(`  ..  ${label}: ${JSON.stringify(value)}`)

// A real 1x1 PNG, uploaded through the actual file input so the stored blob is
// produced by the app's own save path rather than injected into IndexedDB.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Starts `vite dev` on the fixed port and resolves once it answers. */
async function startServer() {
  const proc = spawn('cmd.exe', ['/c', `npm run dev -- --port ${PORT} --strictPort`], {
    cwd: process.cwd(),
    stdio: 'ignore',
  })

  for (let i = 0; i < 120; i += 1) {
    await settle(250)
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return proc
    } catch {
      /* not up yet */
    }
  }
  proc.kill()
  throw new Error('dev server did not become ready')
}

/**
 * Stops whatever is listening on the port, and waits until it is free.
 *
 * Killing by port ownership rather than by the spawn's own PID: `npm run dev`
 * starts vite as a *grandchild* process, and the intermediate shells die while
 * the actual listener survives, holding the port. Whatever owns the socket is
 * by definition the thing that has to go.
 */
async function stopServer(proc) {
  try {
    proc.kill()
  } catch {
    /* already gone */
  }

  const script =
    `$c = Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ` +
    `Select-Object -ExpandProperty OwningProcess -Unique; ` +
    `foreach ($p in $c) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }`

  spawn('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })

  for (let i = 0; i < 80; i += 1) {
    await settle(250)
    try {
      await fetch(BASE, { signal: AbortSignal.timeout(1000) })
    } catch {
      return // confirmed down
    }
  }
  throw new Error('dev server did not stop')
}

/** Adds a book through the manual form and attaches a real uploaded image. */
async function addBookWithCover(page) {
  const send = (m, p) => page.send(m, p)
  await page.eval(
    `[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === 'add-book-button')?.click()`,
  )
  await settle(500)
  await page.eval(`[...document.querySelectorAll('[role="tab"]')][1]?.click()`)
  await settle(400)

  const labels = ['عنوان', 'نویسنده']
  const values = ['کتاب با جلد', 'نویسندهٔ آزمایشی']

  for (let i = 0; i < labels.length; i += 1) {
    const wanted = JSON.stringify(labels[i])
    const focused = await page.eval(
      `(() => {
        const panel = document.querySelector('[role="tabpanel"]:not([hidden])')
        if (!panel) return false
        const l = [...panel.querySelectorAll('label')].find((x) => x.textContent.includes(${wanted}))
        const input = l && document.getElementById(l.htmlFor)
        if (!input) return false
        input.focus()
        return document.activeElement === input
      })()`,
    )
    if (!focused) throw new Error('could not focus ' + labels[i])
    await send('Input.insertText', { text: values[i] })
    await settle(150)
  }

  await page.eval(uploadScript())
  await settle(700)
  await page.eval(
    `[...document.querySelectorAll('[role="dialog"] button[type="submit"]')].pop()?.click()`,
  )
  await settle(800)
}

/** Builds the in-page upload snippet, embedding the PNG as a literal. */
function uploadScript() {
  return `(async () => {
  const bin = atob('${PNG_BASE64}')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  const file = new File([bytes], 'cover.png', { type: 'image/png' })
  const input = document.querySelector('input[type="file"]')
  if (!input) return 'no-file-input'
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 250))
  return 'dispatched'
})()`
}

/** Reads blob ids, their sizes, the persisted references, and what renders. */
function stateScript() {
  return `(async () => {
  const open = () => new Promise((resolve, reject) => {
    const r = indexedDB.open('reading-journal', 1)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  let keys = []
  let blobSizes = []
  try {
    const db = await open()
    if (db.objectStoreNames.contains('images')) {
      const store = db.transaction('images', 'readonly').objectStore('images')
      keys = await new Promise((res, rej) => {
        const rq = store.getAllKeys(); rq.onsuccess = () => res(rq.result.map(String)); rq.onerror = () => rej(rq.error)
      })
      const blobs = await new Promise((res, rej) => {
        const rq = store.getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
      })
      blobSizes = blobs.map((b) => (b instanceof Blob ? b.size : -1))
    }
  } catch (e) {
    return { error: String(e) }
  }
  const stored = JSON.parse(localStorage.getItem('reading-journal:books') ?? '{}')
  const books = stored.books ?? []
  const rendered = [...document.querySelectorAll('img')].filter((i) => (i.src || '').startsWith('blob:'))
  return {
    idbKeys: keys,
    blobSizes,
    bookCount: books.length,
    coverRefs: books.map((b) => b.coverImage ?? null),
    renderedImages: rendered.length,
  }
})()`
}

let server = null
let page = null
try {
  console.log(`--- 1. start the dev server on ${BASE} ---`)
  server = await startServer()
  console.log('   dev server is up')

  page = await launch({ prefersDark: false })
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await page.goto(BASE)
  // A genuine first load, which is the one that performs the one-time cleanup.
  await page.eval(`localStorage.clear()`)
  await page.reload()
  await settle(900)

  console.log('\n--- 2. add a book and upload a real cover image ---')
  await addBookWithCover(page)
  const uploaded = await page.eval(stateScript())
  report('state after upload', uploaded)
  check('book added', uploaded.bookCount, 1)
  check('one image in IndexedDB', uploaded.idbKeys.length, 1)
  check('cover image renders', uploaded.renderedImages, 1)

  const imageId = uploaded.idbKeys[0]
  const coverRef = uploaded.coverRefs[0]

  console.log('\n--- 3. reload without stopping the server ---')
  await page.reload()
  await settle(1000)
  let state = await page.eval(stateScript())
  check('image id unchanged', state.idbKeys[0], imageId)
  check('cover reference unchanged', state.coverRefs[0], coverRef)
  check('cover still renders', state.renderedImages, 1)

  console.log('\n--- 4. STOP the dev server ---')
  await stopServer(server)
  server = null
  console.log('   dev server stopped; the port now refuses connections')

  console.log('\n--- 5. START the dev server again on the same port ---')
  server = await startServer()
  console.log('   dev server restarted on the same origin')

  console.log('\n--- 6. reload the page ---')
  await page.reload()
  await settle(1100)
  state = await page.eval(stateScript())
  report('state after restart', state)

  check('book survived the restart', state.bookCount, 1)
  check('image id survived the restart', state.idbKeys[0], imageId)
  check('cover reference survived', state.coverRefs[0], coverRef)
  check('stored blob still readable', state.blobSizes[0] > 0, true)
  check('cover image still renders', state.renderedImages, 1)
} finally {
  if (page) await page.close()
  if (server) {
    try {
      spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  }
}

console.log(failed === 0 ? '\nDEV-SERVER RESTART CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1

// A real 1x1 PNG, uploaded through the actual file input so the stored blob is
// produced by the app's own save path rather than injected.