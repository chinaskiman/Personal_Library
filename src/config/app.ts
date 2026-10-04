/**
 * Single place to rename the project.
 *
 * The product name is a temporary placeholder ("Reading Journal"). Change
 * `name` / `nameFa` here and the sidebar, page titles and the document
 * title are updated everywhere.
 */
export const APP_CONFIG = {
  /** Latin product name, rendered in the editorial serif. */
  name: 'Reading Journal',
  /** Persian product name, rendered in the Persian sans. */
  nameFa: 'دفتر مطالعه',
  /** Short Persian descriptor used under the wordmark. */
  tagline: 'یادداشت‌های خواندن',
  /** The owner of this journal, shown in the profile placeholder. */
  owner: 'دوست کتاب',
  /** Human readable build label. */
  version: '۰٫۱٫۰',
} as const

/** Document language + direction. Mirrors `index.html`. */
export const DOCUMENT_LANG = 'fa'
export const DOCUMENT_DIR = 'rtl' as const
