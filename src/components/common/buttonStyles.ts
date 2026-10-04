/**
 * ---------------------------------------------------------------------------
 *  BUTTON STYLES
 * ---------------------------------------------------------------------------
 * The app's button vocabulary, in one place.
 *
 * Before this existed the same primary button was retyped in roughly a dozen
 * places and had drifted into three heights and three horizontal paddings, so
 * two buttons sitting a few rows apart could differ by 4px. Keeping the strings
 * here means a change lands everywhere at once and the two buttons that are
 * meant to look identical actually do.
 *
 * These are class *strings*, not a component, because the buttons carry a wide
 * variety of content (icon + label, label only, plus wrapping and spacing
 * utilities). Keeping them as composable fragments preserves that flexibility
 * while making the shared part consistent.
 *
 * Three variants, matching the editorial identity: a filled accent button for
 * the main action, a quiet bordered button for secondary actions, and a
 * destructive button that is deliberately red rather than accent-tinted so it
 * never reads as an ordinary primary action.
 * ---------------------------------------------------------------------------
 */

/**
 * Layout and typography shared by every variant.
 *
 * `disabled:` is included because every one of these buttons ends up disabled at
 * some point (a running export, a clear with nothing to clear), and forgetting it
 * left the control looking fully interactive.
 */
const BASE =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-[0.8rem] ' +
  'transition-colors duration-200 ease-editorial ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

/** Main action: filled accent, light label. */
export const PRIMARY_BUTTON =
  `${BASE} border border-accent bg-accent font-medium text-canvas ` +
  'hover:border-accent-strong hover:bg-accent-strong'

/** Secondary action: quiet surface that warms towards accent on hover. */
export const SECONDARY_BUTTON =
  `${BASE} border border-line bg-surface-raised font-medium text-ink ` +
  'hover:border-accent hover:bg-accent-wash'

/**
 * Destructive action: the same shape as the primary button, but in the muted red
 * used for the "dropped" status so the difference is a colour difference, not a
 * shape difference.
 */
export const DESTRUCTIVE_BUTTON =
  `${BASE} border border-status-dropped bg-status-dropped font-medium text-canvas ` +
  'hover:bg-status-dropped/90'

/** Icon-only square button, for edit/delete affordances on a card. */
export const ICON_BUTTON =
  'inline-flex size-7 items-center justify-center rounded-md text-ink-faint ' +
  'transition-colors duration-200 ease-editorial hover:bg-surface-sunken hover:text-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-50'