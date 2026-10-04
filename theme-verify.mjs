// ---------------------------------------------------------------------------
//  THEME VERIFICATION — real Chrome, no new dependency
// ---------------------------------------------------------------------------
// Drives the built app in the Chrome already installed on this machine over the
// DevTools Protocol (see theme-cdp.mjs), so switching and persistence are checked
// in a real browser rather than inferred from unit tests.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node theme-verify.mjs
//
// Exit code is non-zero if any check fails.
// ---------------------------------------------------------------------------
import { launch } from './theme-cdp.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'

let failed = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failed += 1
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`,
  )
}

/** Reads the live DOM, the persisted key, and the resolved CSS token. */
const PROBE = `(() => ({
  dataTheme: document.documentElement.dataset.theme,
  stored: localStorage.getItem('reading-journal:theme'),
  meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  checked: document.querySelector('[role="radio"][aria-checked="true"]')?.dataset.testid ?? null,
  canvas: getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim(),
  books: localStorage.getItem('reading-journal:books'),
  notes: localStorage.getItem('reading-journal:notes'),
  keys: Object.keys(localStorage).sort(),
}))()`

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms))

async function openSettings(page) {
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('تنظیمات'))?.click()`)
  await settle(150)
}

/** Clicks a theme option. Assumes Settings is already open, so nothing else changes. */
const pick = (page, value) =>
  page.eval(`(() => { const b = document.querySelector('[data-testid="theme-${value}"]'); if (!b) return false; b.click(); return true })()`)

async function freshPage(prefersDark) {
  const page = await launch({ prefersDark })
  await page.goto(BASE)
  await page.eval(`localStorage.clear()`)
  await page.reload()
  await settle()
  return page
}

/* -------------------------------------------------------------------------- *
 *  1. Basic switching and persistence
 * -------------------------------------------------------------------------- */
console.log('--- switching and reload persistence ---')
{
  const page = await freshPage(false)
  try {
    let s = await page.eval(PROBE)
    check('default theme', s.dataTheme, 'light')
    check('nothing stored on first visit', s.stored, null)

    await openSettings(page)
    await pick(page, 'dark')
    await settle()
    s = await page.eval(PROBE)
    check('dark applied', s.dataTheme, 'dark')
    check('dark repaints tokens', s.canvas, '#1b1815')
    check('dark chrome colour', s.meta, '#1B1815')
    check('dark radio checked', s.checked, 'theme-dark')
    check('dark persisted', s.stored, 'dark')

    // Persistence across a genuine document reload, not a remount.
    await page.reload()
    await settle()
    s = await page.eval(PROBE)
    check('dark survives reload', s.dataTheme, 'dark')

    // A reload also resets routing to Home, so the selector has to be reopened
    // before the control reflecting the restored preference can be inspected.
    await openSettings(page)
    s = await page.eval(PROBE)
    check('radio restored after reload', s.checked, 'theme-dark')

    await openSettings(page)
    await pick(page, 'light')
    await settle()
    s = await page.eval(PROBE)
    check('light applied', s.dataTheme, 'light')
    check('light persisted', s.stored, 'light')
  } finally {
    await page.close()
  }
}

/* -------------------------------------------------------------------------- *
 *  2. System mode, and OS changes while it is live
 * -------------------------------------------------------------------------- */
console.log('--- system mode and live OS changes ---')
{
  const page = await freshPage(false)
  try {
    await openSettings(page)
    await pick(page, 'system')
    await settle()
    let s = await page.eval(PROBE)
    check('system + light OS resolves light', s.dataTheme, 'light')
    check('preference stays system', s.stored, 'system')

    await page.setEmulatedDark(true)
    await settle(300)
    s = await page.eval(PROBE)
    check('system follows OS to dark', s.dataTheme, 'dark')
    check('OS change does not overwrite preference', s.stored, 'system')

    await page.setEmulatedDark(false)
    await settle(300)
    check('system follows OS back to light', (await page.eval(PROBE)).dataTheme, 'light')

    await page.reload()
    await settle()
    check('system survives reload', (await page.eval(PROBE)).stored, 'system')
  } finally {
    await page.close()
  }
}

/* -------------------------------------------------------------------------- *
 *  3. The regression this fix addressed
 *
 *  An OS change while in System mode used to leave React's derived theme stale:
 *  picking an explicit option then recomputed the same stale value, so the apply
 *  effect never ran and the screen kept the OS palette while storage held the new
 *  choice. Reproduced by staying on Settings so no unrelated re-render intervenes.
 * -------------------------------------------------------------------------- */
console.log('--- explicit choice after a live OS change (regression) ---')
{
  const page = await freshPage(false)
  try {
    await openSettings(page)
    await pick(page, 'system')
    await settle()
    await page.setEmulatedDark(true)
    await settle(300)
    check('OS moved to dark while in system', (await page.eval(PROBE)).dataTheme, 'dark')

    await pick(page, 'light')
    await settle(300)
    let s = await page.eval(PROBE)
    check('clicking light repaints the screen', s.dataTheme, 'light')
    check('clicking light repaints tokens', s.canvas, '#f7f4ed')
    check('clicking light persists', s.stored, 'light')

    // The mirror image: OS light, then asking for dark.
    await pick(page, 'system')
    await settle()
    await page.setEmulatedDark(false)
    await settle(300)
    check('OS moved to light while in system', (await page.eval(PROBE)).dataTheme, 'light')

    await pick(page, 'dark')
    await settle(300)
    s = await page.eval(PROBE)
    check('clicking dark repaints the screen', s.dataTheme, 'dark')
    check('clicking dark repaints tokens', s.canvas, '#1b1815')
    check('clicking dark persists', s.stored, 'dark')

    // What is on screen must agree with what a reload shows.
    await page.reload()
    await settle()
    check('screen and reload agree', (await page.eval(PROBE)).dataTheme, 'dark')
  } finally {
    await page.close()
  }
}

/* -------------------------------------------------------------------------- *
 *  4. Invalid values, a dark OS on first visit, and library isolation
 * -------------------------------------------------------------------------- */
console.log('--- fallbacks and library isolation ---')
{
  const page = await launch({ prefersDark: true })
  try {
    await page.goto(BASE)
    await page.eval(`localStorage.clear()`)
    await page.reload()
    await settle()
    // A dark device with nothing stored must still get the documented default.
    check('dark OS + no stored value defaults to light', (await page.eval(PROBE)).dataTheme, 'light')

    await openSettings(page)
    await pick(page, 'system')
    await settle()
    check('system adopts a dark OS', (await page.eval(PROBE)).dataTheme, 'dark')
  } finally {
    await page.close()
  }

  const page2 = await freshPage(false)
  try {
    await settle(300)
    const before = await page2.eval(PROBE)

    await openSettings(page2)
    for (const value of ['dark', 'system', 'light', 'dark']) {
      await pick(page2, value)
      await settle(150)
    }

    const after = await page2.eval(PROBE)
    check('books untouched by theme changes', after.books, before.books)
    check('notes untouched by theme changes', after.notes, before.notes)
    check('no library key removed', before.keys.every((k) => after.keys.includes(k)), true)
    // The theme's own key is the only permitted addition.
    check('only the theme key is added', after.keys.filter((k) => !before.keys.includes(k)), [
      'reading-journal:theme',
    ])

    // A stored value this build cannot interpret must not break startup.
    await page2.eval(`localStorage.setItem('reading-journal:theme', 'neon')`)
    await page2.reload()
    await settle()
    check(
      'invalid stored value falls back to light',
      (await page2.eval(PROBE)).dataTheme,
      'light',
    )
  } finally {
    await page2.close()
  }
}

console.log(failed === 0 ? '\nALL THEME CHECKS PASSED' : `\n${failed} THEME CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1