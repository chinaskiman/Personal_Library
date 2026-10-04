// ---------------------------------------------------------------------------
//  EMPTY-LIBRARY CHECK — a real browser
// ---------------------------------------------------------------------------
// Verifies the three things this phase promises, against the production build:
//
//   1. A browser carrying the old sample library is cleaned to empty, and stays
//      empty across repeated refreshes (the reset must not re-run or re-seed).
//   2. The theme preference survives the cleanup.
//   3. A new book can be added afterwards and persists.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node ui-empty.mjs
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

const THEME_KEY = 'reading-journal:theme'

/** What the app is actually showing, read from the rendered DOM. */
const VIEW = `(() => ({
  theme: document.documentElement.dataset.theme,
  storedTheme: localStorage.getItem(${JSON.stringify(THEME_KEY)}),
  books: JSON.parse(localStorage.getItem('reading-journal:books') ?? '{}').books ?? [],
  notes: JSON.parse(localStorage.getItem('reading-journal:notes') ?? '[]'),
  marker: localStorage.getItem('reading-journal:reset-v1'),
  // Headings rendered anywhere on the page, to catch sample content reappearing.
  onScreen: [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.textContent.trim()).filter(Boolean),
}))()`

/** Titles of the invented books the old build used to ship. */
const SAMPLE_TITLES = [
  'The Remains of the Day',
  'Invisible Cities',
  'A Fine Balance',
  'The Overstory',
  'Persian Letters',
  'The Book of Disquiet',
  'Season of Migration to the North',
  'The Great Gatsby',
]

/** Any sample title visible on the current page? */
const sampleVisible = (headings) =>
  headings.some((t) => SAMPLE_TITLES.some((s) => t.includes(s)))

/** Seeds a previous install: sample books, notes, and a dark theme choice. */
const SEED = `(() => {
  const now = new Date().toISOString()
  const books = [
    { id: 'demo-1', title: 'The Remains of the Day', author: 'Kazuo Ishiguro', status: 'reading', origin: 'demo', shelf: 'personal', progress: 0.6, lastAccessedAt: now, noteCount: 0, quoteCount: 0 },
    { id: 'demo-2', title: 'Invisible Cities', author: 'Italo Calvino', status: 'finished', origin: 'demo', shelf: 'personal', progress: 1, lastAccessedAt: now, noteCount: 0, quoteCount: 0 },
    { id: 'demo-3', title: 'A Fine Balance', author: 'Rohinton Mistry', status: 'want-to-read', origin: 'demo', shelf: 'personal', progress: 0, lastAccessedAt: now, noteCount: 0, quoteCount: 0 },
  ]
  localStorage.setItem('reading-journal:books', JSON.stringify({ books, overrides: { 'demo-1': { progress: 0.9 } } }))
  localStorage.setItem('reading-journal:notes', JSON.stringify([
    { id: 'n1', bookId: 'demo-1', type: 'text', content: 'یادداشت نمونه', createdAt: now },
  ]))
  localStorage.setItem('reading-journal:version', '1')
  localStorage.setItem(${JSON.stringify(THEME_KEY)}, 'dark')
  return books.length
})()`

const page = await launch({ prefersDark: false })
const send = (m, p) => page.send(m, p)

/** Adds a book through the manual-entry form, typed as a user would. */
async function addBook(title, author) {
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === 'add-book-button')?.click()`)
  await settle(400)
  await page.eval(`[...document.querySelectorAll('[role="tab"]')][1]?.click()`)
  await settle(350)

  for (const [label, value] of [['عنوان', title], ['نویسنده', author]]) {
    const focused = await page.eval(`(() => {
      const panel = document.querySelector('[role="tabpanel"]:not([hidden])')
      if (!panel) return false
      const l = [...panel.querySelectorAll('label')].find((x) => x.textContent.includes(${JSON.stringify(label)}))
      const input = l && document.getElementById(l.htmlFor)
      if (!input) return false
      input.focus()
      return document.activeElement === input
    })()`)
    if (!focused) throw new Error('could not focus field ' + label)
    await send('Input.insertText', { text: value })
    await settle(120)
  }

  await page.eval(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')].pop()?.click()`)
  await settle(650)
}

try {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

  console.log('--- seed a previous install with the old sample library ---')
  await page.goto(BASE)
  // The first load performs the reset, so the old data is seeded *after* it and
  // then reloaded — which is what a returning user's browser would look like.
  await page.eval(`localStorage.clear()`)
  await page.reload()
  await settle(450)
  await page.eval(`localStorage.removeItem('reading-journal:reset-v1')`)
  check('seeded sample records', await page.eval(SEED), 3)

  console.log('--- reload: the cleanup must run and empty the library ---')
  await page.reload()
  await settle(650)

  let view = await page.eval(VIEW)
  check('books cleared', view.books, [])
  check('notes cleared', view.notes, [])
  check('reset marker written', view.marker, '1')

  console.log('--- the theme choice survives the cleanup ---')
  check('theme preserved in storage', view.storedTheme, 'dark')
  check('dark theme applied', view.theme, 'dark')

  console.log('--- no sample titles are rendered ---')
  check('no sample titles on load', sampleVisible(view.onScreen), false)

  console.log('--- repeated refreshes must not re-seed or re-run ---')
  for (let i = 1; i <= 3; i += 1) {
    await page.reload()
    await settle(500)
    view = await page.eval(VIEW)
    check(`refresh ${i}: still empty`, view.books.length, 0)
    check(`refresh ${i}: notes still empty`, view.notes.length, 0)
  }

  console.log('--- every page shows an empty state ---')
  for (const nav of ['nav-home', 'nav-library', 'nav-notes', 'nav-insights']) {
    await page.eval(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('data-testid') === ${JSON.stringify(nav)})?.click()`)
    await settle(500)
    const shown = (await page.eval(VIEW)).onScreen
    check(`${nav}: no sample titles`, sampleVisible(shown), false)
  }

  console.log('--- adding a book still works after the cleanup ---')
  await addBook('کتاب تازهٔ من', 'نویسندهٔ نو')
  view = await page.eval(VIEW)
  check('new book stored', view.books.map((b) => b.title), ['کتاب تازهٔ من'])
  check('new book marked as user', view.books[0].origin, 'user')

  console.log('--- and it survives a reload ---')
  await page.reload()
  await settle(650)
  view = await page.eval(VIEW)
  check('book persists after reload', view.books.map((b) => b.title), ['کتاب تازهٔ من'])
  check('theme still dark at the end', view.storedTheme, 'dark')
} finally {
  await page.close()
}

console.log(failed === 0 ? '\nEMPTY-LIBRARY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1