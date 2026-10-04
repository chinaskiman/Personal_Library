// ---------------------------------------------------------------------------
//  CONTRAST CHECK
// ---------------------------------------------------------------------------
// Measures every text token against every surface it is rendered on, in both
// themes, using the real computed CSS variables. Run after touching any colour
// token in styles/index.css.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort
//   node ui-contrast.mjs
// ---------------------------------------------------------------------------
import { launch } from './theme-cdp.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'

const CONTRAST = `(() => {
  const cs = getComputedStyle(document.documentElement)
  const hex = (name) => {
    const m = /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue(name).trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100
  }

  const surfaces = ['--color-canvas', '--color-surface', '--color-surface-raised']
  const texts = ['--color-ink', '--color-ink-soft', '--color-ink-faint', '--color-accent', '--color-status-dropped']
  const out = []
  for (const s of surfaces) {
    const bg = hex(s)
    if (!bg) continue
    for (const t of texts) {
      const fg = hex(t)
      if (fg) out.push({ on: s, text: t, ratio: ratio(fg, bg) })
    }
  }
  return out
})()`

let failed = 0
for (const theme of ['light', 'dark']) {
  const page = await launch({ prefersDark: theme === 'dark' })
  try {
    await page.goto(BASE)
    await page.eval(`localStorage.setItem('reading-journal:theme', ${JSON.stringify(theme)})`)
    await page.reload()
    await new Promise((r) => setTimeout(r, 450))

    console.log(`\n=== ${theme} ===`)
    for (const row of await page.eval(CONTRAST)) {
      // AA for normal text is 4.5:1, and every one of these tokens is used at
      // small sizes (0.7-0.85rem), so the strict threshold applies.
      const ok = row.ratio >= 4.5
      if (!ok) failed += 1
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${row.text.padEnd(24)} on ${row.on.padEnd(24)} ${row.ratio}`)
    }
  } finally {
    await page.close()
  }
}
console.log(failed === 0 ? '\nALL TEXT TOKENS MEET AA' : `\n${failed} PAIR(S) BELOW AA`)
process.exitCode = failed === 0 ? 0 : 1