const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/**
 * Convert Western digits to Persian digits.
 * Used everywhere a number is mixed into Persian copy so the numerals match
 * the surrounding script.
 */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])
}

/** Format a number with thousands separators, in Persian digits. */
export function formatNumber(value: number): string {
  return toPersianDigits(new Intl.NumberFormat('en-US').format(value))
}

/** Render a 0–1 ratio as a whole percentage in Persian digits. */
export function formatPercent(ratio: number): string {
  return `${toPersianDigits(Math.round(ratio * 100))}٪`
}

/** Convert minutes into a compact Persian duration, e.g. «۴۵ دقیقه». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${toPersianDigits(hours)} ساعت`
  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`
}

/**
 * Convert one fractional number to Persian, including its decimal separator.
 *
 * `toPersianDigits` deliberately handles digits only, so the separator has to be
 * converted separately — Persian writes it as «٫», and a Latin "." would sit in
 * the middle of Persian text looking like a stray character.
 */
function formatDecimal(value: number): string {
  return toPersianDigits(value.toFixed(1)).replace('.', '٫')
}

/**
 * Render a byte count as a Persian size, e.g. «۱٫۴ مگابایت».
 *
 * Deliberately coarse: these figures come from an estimate the browser may pad or
 * compress, so a single decimal place is already the most precision the number
 * deserves. Negative or unusable input reads as zero rather than rendering as
 * «-۰», so a nonsensical browser figure cannot produce a nonsensical label.
 */
export function formatBytes(bytes: number): string {
  // Kept inside the first branch rather than as a bare number so a zero-sized
  // library still reads as a size, in the same shape as every other value.
  if (!Number.isFinite(bytes) || bytes <= 0) return `${toPersianDigits(0)} بایت`

  if (bytes < 1024) return `${formatNumber(bytes)} بایت`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${formatDecimal(kilobytes)} کیلوبایت`

  return `${formatDecimal(kilobytes / 1024)} مگابایت`
}
