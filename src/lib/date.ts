import { toPersianDigits } from '@/lib/format'

/** Difference between two dates in whole days. */function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((to.getTime() - from.getTime()) / msPerDay)
}

/**
 * Relative Persian date label, e.g. «امروز», «۳ روز پیش», «۲ هفته پیش».
 * Falls back to a Jalali date once the gap stops being meaningful.
 *
 * An unparseable or future timestamp returns an empty string rather than
 * claiming "today" — the arithmetic below yields `NaN`, and every comparison
 * would otherwise silently be false, leaving `NaN` to be rendered as a number.
 */
export function formatRelativeDate(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  const days = daysBetween(date, now)
  if (Number.isNaN(days)) return ''

  // Anything dated after "now" is corrupt data, not the present.
  if (days < 0) return ''
  if (days <= 0) return 'امروز'
  if (days === 1) return 'دیروز'
  if (days < 7) return `${toPersianDigits(days)} روز پیش`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${toPersianDigits(weeks)} هفته پیش`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${toPersianDigits(months)} ماه پیش`
  }
  const years = Math.floor(days / 365)
  return `${toPersianDigits(years)} سال پیش`
}

/** Long-form Persian (Jalali) date for page headers. */
const jalaliFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/** Persian weekday, e.g. «دوشنبه». */
const weekdayFormatter = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })

/**
 * Long-form Persian (Jalali) date.
 *
 * An unparseable value yields an empty string rather than throwing. `Intl`
 * raises `RangeError: Invalid time value` on a `Date` whose time is `NaN`, and
 * a single malformed record in storage must not be able to take down a whole
 * page — so callers can render the result unguarded.
 */
export function formatJalaliDate(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return ''
  return jalaliFormatter.format(date)
}

/**
 * Persian (Jalali) date for an ISO string, or `null` when it is unusable.
 * Lets callers skip the date element entirely instead of printing a blank one.
 */
export function formatJalaliDateOrNull(iso: string | undefined): string | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return formatJalaliDate(parsed)
}

export function formatWeekday(date: Date = new Date()): string {
  return weekdayFormatter.format(date)
}
