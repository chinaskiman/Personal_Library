// ---------------------------------------------------------------------------
//  WORKFLOW CHECK — the everyday paths, in a real browser
// ---------------------------------------------------------------------------
// Adds books through the manual-entry flow, checks search filtering, switches
// theme, then reloads to prove everything persisted. Also asserts that library
// data is untouched by the appearance changes.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node ui-workflow.mjs
// ---------------------------------------------------------------------------
import { launch } from './theme-cdp.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const settle = (ms = 320) => new Promise((r) => setTimeout(r, ms))

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
}

/** The persisted user library, read straight out of storage. */
const LIBRARY = `(() => {
  const books = JSON.parse(localStorage.getItem('reading-journal:books') ?? '{}').books ?? []
  return { titles: books.map((b) => b.title).sort() }
})()`

const page = await launch({ prefersDark: false })
const send = (m, p) => page.send(m, p)

/** Opens the add-book dialog on the manual-entry tab. */
async function openManualEntry() {
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === 'add-book-button')?.click()`)
  await settle(400)
  await page.eval(`[...document.querySelectorAll('[role="tab"]')][1]?.click()`)
  await settle(350)
}

/**
 * Types into the dialog field whose label contains `labelText`.
 *
 * Both tab panels stay mounted (the inactive one is `hidden`), so the field is
 * located by its label rather than by position.
 */
async function fillField(labelText, value) {
  const focused = await page.eval(`(() => {
    // Scope to the *visible* tab panel: both panels stay mounted and the hidden
    // one still carries labels (the catalog search hint mentions "عنوان"), so an
    // unscoped search can match a field that cannot receive focus.
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])')
    if (!panel) return false
    const label = [...panel.querySelectorAll('label')].find((l) => l.textContent.includes(${JSON.stringify(labelText)}))
    const input = label && document.getElementById(label.htmlFor)
    if (!input) return false
    input.focus()
    return document.activeElement === input
  })()`)
  if (!focused) throw new Error(`could not focus field labelled ${labelText}`)
  await send('Input.insertText', { text: value })
  await settle(120)
}

async function submitDialog() {
  await page.eval(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')].pop()?.click()`)
  await settle(700)
}

try {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.goto(BASE)
  await page.eval(`localStorage.clear()`)
  await page.reload()
  await settle(450)

  console.log('--- add a book via manual entry ---')
  await openManualEntry()
  await fillField('عنوان', 'کتاب آزمایشی')
  await fillField('نویسنده', 'نویسندهٔ نمونه')
  await submitDialog()
  check('book persisted', (await page.eval(LIBRARY)).titles, ['کتاب آزمایشی'])

  console.log('--- add a second book ---')
  await openManualEntry()
  await fillField('عنوان', 'رمان دوم')
  await fillField('نویسنده', 'نویسندهٔ دیگر')
  await submitDialog()
  check('two books persisted', (await page.eval(LIBRARY)).titles, ['رمان دوم', 'کتاب آزمایشی'])

  console.log('--- library page renders both ---')
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === 'nav-library')?.click()`)
  await settle(450)
  const headings = await page.eval(`[...document.querySelectorAll('article h2, article h3')].map((h) => h.textContent.trim()).sort()`)
  check('both books listed', headings.length >= 2, true)

  console.log('--- search narrows the grid ---')
  await page.eval(`document.querySelector('input[type="search"]')?.focus()`)
  await send('Input.insertText', { text: 'رمان' })
  await settle(450)
  const filtered = await page.eval(`[...document.querySelectorAll('article h2, article h3')].map((h) => h.textContent.trim())`)
  check('search narrowed to one book', filtered.length, 1)

  console.log('--- data survives a reload ---')
  await page.reload()
  await settle(550)
  check('both books still persisted', (await page.eval(LIBRARY)).titles.length, 2)

  console.log('--- theme changes leave library data alone ---')
  const beforeTheme = await page.eval(LIBRARY)
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === 'nav-settings')?.click()`)
  await settle(400)
  await page.eval(`document.querySelector('[data-testid="theme-dark"]')?.click()`)
  await settle(400)
  await page.eval(`document.querySelector('[data-testid="theme-light"]')?.click()`)
  await settle(400)
  check('books unchanged by theme switch', await page.eval(LIBRARY), beforeTheme)

  console.log('--- shared button styles render consistently ---')
  // Scoped to the buttons this phase unified. Sweeping every filled button would
  // also catch the theme cards and filter chips, which are deliberately other
  // shapes.
  const buttonHeights = await page.eval(`(() => {
    const ids = ['export-backup', 'clear-library']
    const out = {}
    for (const id of ids) {
      const el = document.querySelector('[data-testid="' + id + '"]')
      out[id] = el ? Math.round(el.getBoundingClientRect().height) : null
    }
    return out
  })()`)
  console.log(`  heights: ${JSON.stringify(buttonHeights)}`)
  check('export and clear share one height', new Set(Object.values(buttonHeights)).size, 1)
} finally {
  await page.close()
}

console.log(failed === 0 ? '\nWORKFLOW CHECKS PASSED' : `\n${failed} WORKFLOW CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1