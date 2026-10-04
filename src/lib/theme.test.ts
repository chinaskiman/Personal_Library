import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COLOR,
  THEME_KEY,
  THEME_OPTIONS,
  parseThemePreference,
  resolveTheme,
} from './theme.ts'

describe('parseThemePreference', () => {
  it('accepts the three supported preferences', () => {
    assert.equal(parseThemePreference('light'), 'light')
    assert.equal(parseThemePreference('dark'), 'dark')
    assert.equal(parseThemePreference('system'), 'system')
  })

  it('falls back to the default for a missing value', () => {
    // localStorage.getItem returns null when the key was never written.
    assert.equal(parseThemePreference(null), DEFAULT_THEME_PREFERENCE)
    assert.equal(parseThemePreference(undefined), DEFAULT_THEME_PREFERENCE)
  })

  it('falls back for invalid or outdated stored values', () => {
    for (const bad of ['', 'neon', 'DARK', 'dark ', 'auto', '0', '{}', 42, true, {}]) {
      assert.equal(
        parseThemePreference(bad),
        DEFAULT_THEME_PREFERENCE,
        `expected ${JSON.stringify(bad)} to fall back`,
      )
    }
  })
})

describe('resolveTheme', () => {
  it('applies an explicit light choice regardless of the OS', () => {
    assert.equal(resolveTheme('light', false), 'light')
    assert.equal(resolveTheme('light', true), 'light')
  })

  it('applies an explicit dark choice regardless of the OS', () => {
    assert.equal(resolveTheme('dark', false), 'dark')
    assert.equal(resolveTheme('dark', true), 'dark')
  })

  it('follows the OS in system mode', () => {
    assert.equal(resolveTheme('system', false), 'light')
    assert.equal(resolveTheme('system', true), 'dark')
  })

  it('changes with the OS while in system mode', () => {
    // This is the transition that used to leave the rendered theme behind: the
    // preference stays `system`, only the device setting moves.
    assert.equal(resolveTheme('system', false), 'light')
    assert.equal(resolveTheme('system', true), 'dark')
    assert.equal(resolveTheme('system', false), 'light')
  })

  it('ignores the OS entirely for an explicit choice', () => {
    // Guard against a device change quietly overriding a saved preference.
    for (const prefersDark of [false, true]) {
      assert.equal(resolveTheme('dark', prefersDark), 'dark')
      assert.equal(resolveTheme('light', prefersDark), 'light')
    }
  })
})

describe('theme constants', () => {
  it('stores the preference under its own namespaced key', () => {
    // The theme must not live inside the persisted library state, or export and
    // replace would carry it and clearing the library would reset it.
    assert.equal(THEME_KEY, 'reading-journal:theme')
  })

  it('defaults to light rather than following the OS', () => {
    assert.equal(DEFAULT_THEME_PREFERENCE, 'light')
  })

  it('offers exactly the three supported options in order', () => {
    assert.deepEqual(
      THEME_OPTIONS.map((option) => option.value),
      ['light', 'dark', 'system'],
    )
  })

  it('gives every option a Persian label and hint', () => {
    for (const option of THEME_OPTIONS) {
      assert.ok(option.label.trim().length > 0, `${option.value} needs a label`)
      assert.ok(option.hint.trim().length > 0, `${option.value} needs a hint`)
    }
  })

  it('has a chrome colour for both palettes', () => {
    // Applied to <meta name="theme-color">, so a missing entry would leave the
    // browser chrome showing the wrong colour after a switch.
    assert.match(THEME_COLOR.light, /^#[0-9A-F]{6}$/i)
    assert.match(THEME_COLOR.dark, /^#[0-9A-F]{6}$/i)
    assert.notEqual(THEME_COLOR.light, THEME_COLOR.dark)
  })
})