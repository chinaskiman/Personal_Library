import { useState } from 'react'
import { BookPlus } from 'lucide-react'

import { CoverUpload } from '@/components/common/CoverUpload'
import { CONTROL_CLASS, Field, controlTone } from '@/components/common/Field'
import { ReadingStatusSelect } from '@/components/add-book/ReadingStatusSelect'
import { PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { normalizeIsbn } from '@/lib/library'
import { toPersianDigits } from '@/lib/format'
import { cn } from '@/lib/cn'
import type {
  AddBookResult,
  NewBookInput,
  ReadingStatus,
} from '@/types/book'

interface ManualFormState {
  title: string
  author: string
  isbn: string
  publishedYear: string
  totalPages: string
  genre: string
  status: ReadingStatus
  progressPercent: string
  coverImage?: string
}

const EMPTY: ManualFormState = {
  title: '',
  author: '',
  isbn: '',
  publishedYear: '',
  totalPages: '',
  genre: '',
  status: 'want-to-read',
  progressPercent: '',
  coverImage: undefined,
}

type Errors = Partial<Record<keyof ManualFormState, string>>

export interface ManualEntryTabProps {
  /** Returns the add outcome so the form can surface duplicate errors. */
  onSubmit: (input: NewBookInput) => AddBookResult
}

/**
 * Manual entry form.
 *
 * Validates on submit and re-validates as the user corrects a field, so
 * messages appear at the moment they become relevant rather than on every
 * keystroke. Titles and author names get `dir="ltr"` with logical padding so
 * English input renders correctly inside the Persian form.
 */
export function ManualEntryTab({ onSubmit }: ManualEntryTabProps) {
  const [form, setForm] = useState<ManualFormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const set = <K extends keyof ManualFormState>(
    key: K,
    value: ManualFormState[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      // Only re-validate after the first submit attempt.
      if (submitAttempted) setErrors(validate(next))
      return next
    })
  }
const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)

    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Wait for the error state to render before hunting for the field,
      // otherwise `aria-invalid` is not on the DOM yet.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    const result = onSubmit(toInput(form))

    if (!result.ok) {
      setErrors(
        result.reason === 'duplicate-isbn'
          ? { isbn: 'این ISBN پیش‌تر برای کتاب دیگری ثبت شده است.' }
          : { title: 'کتابی با همین عنوان و نویسنده از قبل در کتابخانه هست.' },
      )
      return
    }

    setForm(EMPTY)
    setErrors({})
    setSubmitAttempted(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field
        label="عنوان اصلی کتاب"
        required
        error={errors.title}
        hint="همان عنوانی که روی جلد چاپ شده است."
      >
        {(field) => (
          <input
            {...field}
            type="text"
            dir="ltr"
            lang="en"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="The Left Hand of Darkness"
            className={cn(CONTROL_CLASS, controlTone(Boolean(field['aria-invalid'])))}
          />
        )}
      </Field>

      <Field label="نام نویسنده" required error={errors.author}>
        {(field) => (
          <input
            {...field}
            type="text"
            dir="ltr"
            lang="en"
            value={form.author}
            onChange={(event) => set('author', event.target.value)}
            placeholder="Ursula K. Le Guin"
            className={cn(CONTROL_CLASS, controlTone(Boolean(field['aria-invalid'])))}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="ISBN"
          error={errors.isbn}
          hint="اختیاری — برای جلوگیری از ثبت تکراری"
        >
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              lang="en"
              inputMode="numeric"
              value={form.isbn}
              onChange={(event) => set('isbn', event.target.value)}
              placeholder="978-0-441-47812-5"
              className={cn(CONTROL_CLASS, 'tabular', controlTone(Boolean(field['aria-invalid'])))}
            />
          )}
        </Field>

        <Field label="سال انتشار" error={errors.publishedYear} hint="اختیاری">
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={form.publishedYear}
              onChange={(event) => set('publishedYear', event.target.value)}
              placeholder="1969"
              className={cn(CONTROL_CLASS, 'tabular', controlTone(Boolean(field['aria-invalid'])))}
            />
          )}
        </Field>

        <Field label="تعداد صفحات" error={errors.totalPages} hint="اختیاری">
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={form.totalPages}
              onChange={(event) => set('totalPages', event.target.value)}
              placeholder="304"
              className={cn(CONTROL_CLASS, 'tabular', controlTone(Boolean(field['aria-invalid'])))}
            />
          )}
        </Field>

        <Field label="ژانر یا دسته‌بندی" hint="اختیاری">
          {(field) => (
            <input
              {...field}
              type="text"
              value={form.genre}
              onChange={(event) => set('genre', event.target.value)}
              placeholder="علمی‌تخیلی"
              className={cn(CONTROL_CLASS, 'border-line hover:border-line-strong focus:border-accent')}
            />
          )}
        </Field>
      </div>

      <ReadingStatusSelect
        value={form.status}
        onChange={(status) => set('status', status)}
        progressPercent={form.progressPercent}
        onProgressChange={(value) => set('progressPercent', value)}
        progressError={errors.progressPercent}
      />

      <CoverUpload
        value={form.coverImage}
        onChange={(coverImage) => set('coverImage', coverImage)}
        bookTitle={form.title}
      />

      <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
        <button
          type="submit"
          data-testid="manual-submit"
          className={PRIMARY_BUTTON}
        >
          <BookPlus aria-hidden="true" strokeWidth={2} className="size-4" />
          افزودن به کتابخانه
        </button>
      </div>
    </form>
  )
}

/** Validates one field set; runs on submit and on later edits. */
function validate(form: ManualFormState): Errors {
  const errors: Errors = {}

  if (!form.title.trim()) errors.title = 'عنوان کتاب را وارد کنید.'
  if (!form.author.trim()) errors.author = 'نام نویسنده را وارد کنید.'

  if (form.isbn.trim()) {
    const digits = normalizeIsbn(form.isbn.trim())
    if (!/^\d{9}[\dX]$|^\d{13}$/.test(digits)) {
      errors.isbn = 'شمارهٔ ISBN باید ۱۰ یا ۱۳ رقم باشد.'
    }
  }

  const year = form.publishedYear.trim()
  if (year) {
    const maxYear = new Date().getFullYear() + 1
    if (!/^\d{4}$/.test(year) || Number(year) < 1000 || Number(year) > maxYear) {
      errors.publishedYear = `سال معتبر وارد کنید، مثلاً ${toPersianDigits(1400)}.`
    }
  }

  const pages = form.totalPages.trim()
  if (pages && (!/^\d{1,5}$/.test(pages) || Number(pages) < 1)) {
    errors.totalPages = 'تعداد صفحات باید عددی مثبت باشد.'
  }

  if (form.status === 'reading' && form.progressPercent.trim()) {
    const value = Number(form.progressPercent)
    if (!/^\d{1,3}$/.test(form.progressPercent) || value < 0 || value > 100) {
      errors.progressPercent = 'درصد پیشرفت باید عددی بین ۰ تا ۱۰۰ باشد.'
    }
  }

  return errors
}

/** Parse the form into the shared add payload. */
function toInput(form: ManualFormState): NewBookInput {
  const year = form.publishedYear.trim()
  const pages = form.totalPages.trim()
  const percent = form.progressPercent.trim()

  return {
    title: form.title.trim(),
    author: form.author.trim(),
    isbn: form.isbn.trim() || undefined,
    publishedYear: year ? Number(year) : undefined,
    totalPages: pages ? Number(pages) : undefined,
    genre: form.genre.trim() || undefined,
    status: form.status,
    progressPercent: percent ? Number(percent) : undefined,
    coverImage: form.coverImage,
  }
}
