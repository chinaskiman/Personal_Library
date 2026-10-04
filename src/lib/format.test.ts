import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatBytes } from './format.ts'

describe('formatBytes', () => {
  it('reports bytes below a kilobyte', () => {
    assert.equal(formatBytes(0), '۰ بایت')
    assert.equal(formatBytes(512), '۵۱۲ بایت')
    // The thousands separator comes from `formatNumber`, which the rest of the
    // app already uses, so it is left as-is here rather than diverging.
    assert.equal(formatBytes(1023), '۱,۰۲۳ بایت')
  })

  it('switches to kilobytes at 1024 bytes', () => {
    assert.equal(formatBytes(1024), '۱٫۰ کیلوبایت')
    assert.equal(formatBytes(1536), '۱٫۵ کیلوبایت')
    assert.equal(formatBytes(1024 * 1024 - 1), '۱۰۲۴٫۰ کیلوبایت')
  })

  it('switches to megabytes at one kilobyte-scaled megabyte', () => {
    assert.equal(formatBytes(1024 * 1024), '۱٫۰ مگابایت')
    assert.equal(formatBytes(1024 * 1024 * 2.5), '۲٫۵ مگابایت')
  })

  it('reads unusable values as zero rather than rendering a negative size', () => {
    // A browser can report a nonsensical figure; the page must still render.
    assert.equal(formatBytes(-1), '۰ بایت')
    assert.equal(formatBytes(Number.NaN), '۰ بایت')
    assert.equal(formatBytes(Number.POSITIVE_INFINITY), '۰ بایت')
  })

  it('uses Persian digits and a Persian decimal separator', () => {
    const rendered = formatBytes(2048)
    assert.equal(rendered, '۲٫۰ کیلوبایت')
    // No Latin digits or a Latin decimal point may survive into Persian copy.
    assert.ok(!/[0-9.]/.test(rendered), `expected Persian digits, got: ${rendered}`)
  })
})