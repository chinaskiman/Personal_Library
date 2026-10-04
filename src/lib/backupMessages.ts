/**
 * Persian copy for every backup and storage outcome.
 *
 * Kept apart from the logic so the messages can be reviewed as prose, and so no
 * component has to improvise an explanation for a failure. Nothing here exposes
 * an error code, a stack trace, or a storage key — the user sees a sentence
 * about their library, not the machinery behind it.
 */
import type { BackupRejection } from './backup'
import type { ExportFailure, ImportFailure } from './backupService'

/** Rejection reasons from the file format layer. */
export const REJECTION_MESSAGES: Record<BackupRejection, string> = {
  unreadable: 'این فایل یک پشتیبان معتبر نیست و نتوانست آن را خواند.',
  'not-an-object': 'ساختار این فایل با پشتیبان دفتر مطالعه نمی‌خواند.',
  'missing-format':
    'این فایل پشتیبان دفتر مطالعه نیست، یا بخش نسخه در آن ناقص است.',
  'unsupported-version':
    'این پشتیبان از نسخه‌ای تازه‌تر از برنامه ساخته شده و با این نسخه باز نمی‌شود. برنامه را به‌روز کنید یا از دستگاهی که آن را ساخته استفاده کنید.',
  'no-records':
    'این فایل هیچ کتاب یا یادداشتی ندارد؛ برای جلوگیری از پاک شدن اطلاعات، پذیرفته نشد.',
  'too-large':
    'حجم این فایل از اندازه‌ای که پشتیبانی می‌شود بزرگ‌تر است.',
}

/** Export failures. */
export const EXPORT_MESSAGES: Record<ExportFailure, string> = {
  'no-records':
    'هنوز کتاب یا یادداشتی از خودتان نساخته‌اید، پس چیزی برای پشتیبان‌گیری وجود ندارد.',
  'too-large':
    'حجم کتابخانه و تصویرهای شما برای یک فایل پشتیبان بزرگ است. می‌توانید یادداشت‌های تصویری قدیمی‌تر را حذف کنید و دوباره تلاش کنید.',
  'no-images-readable':
    'تصویرهای این کتابخانه در حافظه در دسترس نبودند؛ برای اینکه پشتیبان ناقص ساخته نشود، پشتیبان‌گیری انجام نشد.',
  'download-failed':
    'ذخیره فایل پشتیبان در این مرورگر ممکن نشد. اگر پنجره‌های دانلود را باز کرده‌اید، دوباره تلاش کنید.',
}

/** Import read failures, covering both format and file-access problems. */
export const IMPORT_MESSAGES: Record<ImportFailure, string> = {
  ...REJECTION_MESSAGES,
  'unreadable-file':
    'این فایل باز نشد. ممکن است دسترسی به آن قطع شده یا ناقص کپی شده باشد.',
}

/** Successful import, with optional caveats about what was skipped. */
export function importSuccessMessage(
  books: number,
  notes: number,
  assets: number,
  warnings: string[],
): string {
  const parts = [`${books} کتاب و ${notes} یادداشت بازگردانده شد`]
  if (assets > 0) parts.push(`${assets} تصویر هم ذخیره شد`)

  const base = `${parts.join('، ')}.`
  // Anything the file itself flagged is repeated, so a partially-restored
  // library is never presented as a complete one.
  return warnings.length > 0 ? `${base} ${warnings.join(' ')}` : base
}

/** Shown when clearing user data succeeds. */
export const CLEAR_SUCCESS = 'کتاب‌ها و یادداشت‌های شما پاک شدند. کتاب‌های نمونه سر جایشان هستند.'

/** Shown when a clear operation could not complete. */
export const CLEAR_FAILURE =
  'پاک کردن کامل انجام نشد و اطلاعات شما دست‌نخورده باقی ماند. لطفاً دوباره تلاش کنید.'