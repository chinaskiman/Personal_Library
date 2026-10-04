import type { ReadingStatus } from '@/types/book'

interface StatusMeta {
  /** Persian label shown on badges. */
  label: string
  /** Badge text colour token. */
  className: string
  /** Dot colour token. */
  dotClassName: string
  /** Longer sentence used in cards and empty states. */
  hint: string
}

/** Presentation metadata for each reading status. */
export const READING_STATUS_META: Record<ReadingStatus, StatusMeta> = {
  reading: {
    label: 'در حال خواندن',
    className: 'text-status-reading',
    dotClassName: 'bg-status-reading',
    hint: 'همین حالا مشغول خواندنش هستید.',
  },
  'want-to-read': {
    label: 'در فهرست مطالعه',
    className: 'text-status-queued',
    dotClassName: 'bg-status-queued',
    hint: 'روی فهرست انتظار شماست.',
  },
  finished: {
    label: 'خوانده‌شده',
    className: 'text-status-finished',
    dotClassName: 'bg-status-finished',
    hint: 'این کتاب را به پایان رسانده‌اید.',
  },
  paused: {
    label: 'متوقف‌شده',
    className: 'text-status-paused',
    dotClassName: 'bg-status-paused',
    hint: 'خواندنش موقتاً کنار گذاشته شده است.',
  },
  abandoned: {
    label: 'کنارگذاشته',
    className: 'text-status-dropped',
    dotClassName: 'bg-status-dropped',
    hint: 'فعلاً ادامه نداده‌اید.',
  },
}

/** Order used whenever statuses are listed. */
/** Order used whenever statuses are listed. */
export const READING_STATUS_ORDER: readonly ReadingStatus[] = [
  'reading',
  'want-to-read',
  'finished',
  'paused',
  'abandoned',
] as const

