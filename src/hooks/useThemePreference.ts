/**
 * ---------------------------------------------------------------------------
 *  APPEARANCE PREFERENCE — the React binding
 * ---------------------------------------------------------------------------
 * All decision-making lives in `lib/theme.ts`; this file only connects those
 * rules to React state and the document.
 *
 * The invariant that matters: **this hook is the only thing that writes
 * `<html data-theme>`.** An earlier version subscribed to the OS media query and
 * called `applyTheme` directly from the change handler. That mutated the
 * document without updating any React state, so the derived `resolved` value
 * silently went stale. Picking an explicit theme afterwards recomputed the *same*
 * stale `resolved`, the apply-effect saw no dependency change, never ran, and the
 * page kept showing the OS palette — while storage correctly held the new choice.
 * Refreshing then appeared to "fix" it. Tracking the OS value as state keeps a
 * single writer, so what is rendered and what React believes cannot diverge.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useEffect, useState } from 'react'

import {
  DARK_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_COLOR,
  THEME_KEY,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

export type { ResolvedTheme, ThemePreference } from '@/lib/theme'
export { THEME_OPTIONS } from '@/lib/theme'

/** The stored preference, or the default when absent or unrecognised. */
function readPreference(): ThemePreference {
  try {
    if (typeof window === 'undefined') return DEFAULT_THEME_PREFERENCE
    return parseThemePreference(window.localStorage.getItem(THEME_KEY))
  } catch {
    // Unavailable storage must not break the app; fall back to the default.
    return DEFAULT_THEME_PREFERENCE
  }
}

/** Whether the OS currently asks for a dark palette. */
function readSystemPrefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(DARK_QUERY).matches
    )
  } catch {
    return false
  }
}

/** Write a resolved palette to the document, including the browser chrome. */
function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme

  // Without this the address bar keeps the light colour in dark mode, which on
  // mobile leaves a bright band above an otherwise dark page.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * Reads and applies the appearance preference.
 *
 * `resolved` is derived from `preference` and the tracked OS setting, and is
 * applied by a single effect. An explicit `light` or `dark` ignores the OS
 * entirely, so a device change can never quietly override the user's choice.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)

  // The OS setting is state, not a read inside render. That is what keeps the
  // derived `resolved` value accurate after a live OS change, so the next
  // explicit choice always produces a genuine change and gets applied.
  const [systemPrefersDark, setSystemPrefersDark] = useState(readSystemPrefersDark)

  // Subscribed unconditionally. Listening only in `system` mode would leave the
  // tracked value stale when the user switches *into* system mode, and would
  // leave no way to notice the OS flipping back.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(DARK_QUERY)

    // Re-read on subscribe: the OS may have changed between the initial render
    // and this effect running. A no-op state update when the value is unchanged.
    setSystemPrefersDark(media.matches)

    const handle = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)

    // `addEventListener` is the modern API; the deprecated `addListener` is
    // ignored because every engine this app targets supports the former.
    media.addEventListener('change', handle)
    return () => media.removeEventListener('change', handle)
  }, [])

  const resolved = resolveTheme(preference, systemPrefersDark)

  // The one and only writer of the document theme. Runs on mount as well, so the
  // value stays correct even if the pre-paint script in index.html was blocked.
  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  /**
   * Record a choice and persist it.
   *
   * Only the *preference* is stored — never the resolved palette — so choosing
   * `system` keeps following the OS instead of freezing today's answer.
   */
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value)
    try {
      window.localStorage.setItem(THEME_KEY, value)
    } catch {
      // Preference is still applied for this session; it just will not persist.
    }
  }, [])

  return { preference, resolved, setPreference }
}