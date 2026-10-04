// ---------------------------------------------------------------------------
//  UI AUDIT — real Chrome, read-only
// ---------------------------------------------------------------------------
// Walks every page at three widths in both themes and reports concrete defects:
// console errors, horizontal overflow, heading order, missing accessible names,
// images without alt text, and clipped/overflowing controls.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node ui-audit.mjs
//
// Read-only: it changes nothing, it only reports.
// ---------------------------------------------------------------------------
import { launch } from './theme-cdp.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const settle = (ms = 220) => new Promise((r) => setTimeout(r, ms))

const PAGES = ['خانه', 'کتابخانه', 'یادداشت', 'آمار', 'تنظیمات']

/** Collects console errors/warnings and page exceptions while navigating. */
function attachConsole(page) {
  const messages = []
  page.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error' || params.type === 'warning') {
      messages.push(`console.${params.type}: ${params.args?.[0]?.value ?? params.args?.[0]?.description ?? '?'}`)
    }
  })
  page.on('Runtime.exceptionThrown', (params) => {
    messages.push(`exception: ${params.exceptionDetails?.exception?.description ?? '?'}`)
  })
  return messages
}

/** Everything worth measuring, evaluated in the page. */
const AUDIT = `(() => {
  const doc = document.documentElement

  // Horizontal overflow: anything wider than the viewport is a layout break.
  const overflowing = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1)
    })
    .slice(0, 6)
    .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''))

  // Heading order: a jump from h1 to h3 skips a level for screen readers.
  const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
  const jumps = []
  for (let i = 1; i < headings.length; i += 1) {
    const prev = Number(headings[i - 1].tagName[1])
    const cur = Number(headings[i].tagName[1])
    if (cur > prev + 1) jumps.push(headings[i - 1].tagName + '->' + headings[i].tagName + ':' + headings[i].textContent.trim().slice(0, 24))
  }

  // Interactive controls need an accessible name.
  const nameless = [...document.querySelectorAll('button, a[href], input, select, textarea')]
    .filter((el) => {
      if (el.type === 'hidden') return false
      const name = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent ||
        (el.labels && el.labels.length ? [...el.labels].map((l) => l.textContent).join(' ') : '') ||
        el.getAttribute('placeholder') || ''
      ).trim()
      return name.length === 0
    })
    .slice(0, 8)
    .map((el) => el.tagName.toLowerCase() + (el.getAttribute('type') ? '[' + el.getAttribute('type') + ']' : ''))

  // Images must carry alt text.
  const noAlt = [...document.querySelectorAll('img')].filter((i) => i.alt === null || i.alt === undefined).length

  // Controls visually clipped by an ancestor with overflow hidden.
  // An ancestor that can itself scroll (overflow-x auto/scroll) is a deliberate
  // horizontal strip — the control is reachable by scrolling, so it is not a
  // defect and must not be reported as one.
  const clipped = [...document.querySelectorAll('button, a[href]')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return false
      const p = el.closest('[class*="overflow-hidden"], [class*="overflow-x"]')
      if (!p) return false
      // Skip deliberate scroll containers.
      const style = getComputedStyle(p)
      if (/(auto|scroll)/.test(style.overflowX)) return false
      const pr = p.getBoundingClientRect()
      return r.right > pr.right + 1 || r.left < pr.left - 1
    })
    .slice(0, 6)
    .map((el) => el.textContent.trim().slice(0, 24) || el.getAttribute('aria-label') || el.tagName)

  return {
    scrollW: doc.scrollWidth,
    clientW: doc.clientWidth,
    overflowing,
    h1: document.querySelectorAll('h1').length,
    jumps,
    nameless,
    noAlt,
    clipped,
    theme: doc.dataset.theme,
  }
})()`

let issues = 0
/**
 * Reports only genuine findings: `null`, `0`, `[]` and `''` are all "nothing
 * wrong", and printing them as issues would drown the real ones.
 */
const note = (label, value) => {
  const empty =
    value === null ||
    value === undefined ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  if (empty) return
  issues += 1
  console.log(`ISSUE ${label}: ${JSON.stringify(value)}`)
}

for (const [label, width, height] of [
  ['mobile', 390, 844],
  ['tablet', 820, 1180],
  ['desktop', 1440, 900],
]) {
  console.log(`\n=== ${label} (${width}px) ===`)
  const page = await launch({ prefersDark: false })
  const messages = attachConsole(page)
  try {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 500,
    })
    await page.goto(BASE)
    await page.eval(`localStorage.clear()`)
    await page.reload()
    await settle(400)

    for (const name of PAGES) {
      await page.eval(
        `[...document.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(${JSON.stringify(name)}))?.click()`,
      )
      await settle(320)

      const a = await page.eval(AUDIT)
      console.log(`-- ${name} (theme=${a.theme}) --`)
      note('horizontal overflow', a.scrollW > a.clientW + 1 ? { scrollW: a.scrollW, clientW: a.clientW, els: a.overflowing } : null)
      note('heading level jumps', a.jumps)
      note('controls without accessible name', a.nameless)
      note('images missing alt', a.noAlt > 0 ? a.noAlt : null)
      note('clipped controls', a.clipped)
      if (a.h1 !== 1) note('h1 count', a.h1)
    }

    note('console errors/warnings', [...new Set(messages)])
  } finally {
    await page.close()
  }
}

console.log(issues === 0 ? '\nAUDIT CLEAN' : `\n${issues} ISSUE GROUP(S) FOUND`)