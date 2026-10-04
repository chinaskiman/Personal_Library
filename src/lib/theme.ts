/**
 * ---------------------------------------------------------------------------
 *  APPEARANCE PREFERENCE — the rules
 * ---------------------------------------------------------------------------
 * Everything here is a total function of its inputs and touches no browser API,
 * so the decisions behind the theme can be tested directly instead of inferred
 * from a rendered page.
 *
 * The theme is a *preference*, not library data, so it lives in its own
 * namespaced key rather than inside the persisted book/note state. That keeps
 * export and replace operations from touching it, and means clearing the
 * library never silently resets how the app looks.
 *
 * Three choices are offered, but only two palettes exist: `system` resolves to
 * whichever concrete theme the OS reports. There is no `auto` ambiguity beyond
 * that, so the applied value is always explicit.
 * ---------------------------------------------------------------------------
 */

/** What the user chose. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** The concrete palette actually rendered. */
export type ResolvedTheme = 'light' | 'dark'

/** Namespaced so it cannot collide with library state or another app. */
export const THEME_KEY = 'reading-journal:theme'

export const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * The preference used when nothing valid is stored.
 *
 * `light`, not `system`: the default is a deliberate choice rather than a
 * request to follow the OS, so a first-time visitor gets the same calm paper
 * palette every time. Following the device is what the `system` option is for.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light'

/**
 * Browser chrome colour per palette.
 *
 * Exported so `index.html`'s pre-paint script and the React hook apply the same
 * colours — two literals that must not drift apart.
 */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#F7F4ED',
  dark: '#1B1815',
}

/** Persian labels, in the order they appear in the selector. */
export const THEME_OPTIONS: readonly {
  value: ThemePreference
  label: string
  hint: string
}[] = [
  { value: 'light', label: 'روشن', hint: 'کاغذ روشن و گرم' },
  { value: 'dark', label: 'تیره', hint: 'برای مطالعه در شب' },
  { value: 'system', label: 'خودکار', hint: 'هماهنگ با تنظیمات دستگاه' },
] as const

/**
 * Validate a stored preference.
 *
 * Anything unrecognised — an older build's value, a hand-edited key, a corrupted
 * string — falls back to the default rather than propagating something the rest
 * of the app cannot interpret.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_THEME_PREFERENCE
}

/**
 * Collapse a preference plus the current OS setting into one palette.
 *
 * Only `system` consults the OS, which is what keeps an explicit choice from
 * being quietly overridden by a device setting.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}