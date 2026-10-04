import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'

import { PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { CoverUpload } from '@/components/common/CoverUpload'
import { CONTROL_CLASS, Field, controlTone } from '@/components/common/Field'
import { Modal } from '@/components/common/Modal'
import { normalizeIsbn } from '@/lib/library'
import { cn } from '@/lib/cn'
import type { Book, EditBookInput } from '@/types/book'

export interface EditBookDialogProps {
  open: boolean
  book: Book
  onClose: () => void
  onSave: (patch: EditBookInput) => void
}

interface Draft {
  title: string
  author: string
  isbn: string
  publishedYear: string
  totalPages: string
  genre: string
  coverImage?: string
}

type Errors = Partial<Record<keyof Draft, string>>

function toDraft(book: Book): Draft {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn ?? '',
    publishedYear: book.publishedYear ? String(book.publishedYear) : '',
    totalPages: book.totalPages ? String(book.totalPages) : '',
    genre: book.genre ?? '',
    coverImage: book.coverImage,
  }
}

/**
 * Edit a book's metadata.
 *
 * Only identity and descriptive fields live here; reading status and progress
 * have their own control on the details page, so the same value is never edited
 * from two places. Validation matches the add-book form so the two do not feel
 * like different applications.
 */
export function EditBookDialog({
  open,
  book,
  onClose,
  onSave,
}: EditBookDialogProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(book))
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  // Re-seed whenever the dialog opens so a cancelled edit is not sticky.
  useEffect(() => {
    if (open) {
      setDraft(toDraft(book))
      setErrors({})
      setSubmitted(false)
    }
  }, [open, book])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (submitted) setErrors(validate(next))
      return next
    })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)

    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    const year = draft.publishedYear.trim()
    const pages = draft.totalPages.trim()

    onSave({
      title: draft.title.trim(),
      author: draft.author.trim(),
      isbn: draft.isbn.trim() || undefined,
      publishedYear: year ? Number(year) : undefined,
      totalPages: pages ? Number(pages) : undefined,
      genre: draft.genre.trim() || undefined,
      coverImage: draft.coverImage,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ویرایش اطلاعات کتاب"
      description="تغییرها روی همین دستگاه ذخیره می‌شوند."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="عنوان کتاب" required error={errors.title}>
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              lang="en"
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              className={cn(CONTROL_CLASS, controlTone(Boolean(field['aria-invalid'])))}
            />
          )}
        </Field>

        <Field label="نویسنده" required error={errors.author}>
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              lang="en"
              value={draft.author}
              onChange={(event) => set('author', event.target.value)}
              className={cn(CONTROL_CLASS, controlTone(Boolean(field['aria-invalid'])))}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ISBN" error={errors.isbn} hint="اختیاری">
            {(field) => (
              <input
                {...field}
                type="text"
                dir="ltr"
                lang="en"
                inputMode="numeric"
                value={draft.isbn}
                onChange={(event) => set('isbn', event.target.value)}
                className={cn(
                  CONTROL_CLASS,
                  'tabular',
                  controlTone(Boolean(field['aria-invalid'])),
                )}
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
                value={draft.publishedYear}
                onChange={(event) => set('publishedYear', event.target.value)}
                className={cn(
                  CONTROL_CLASS,
                  'tabular',
                  controlTone(Boolean(field['aria-invalid'])),
                )}
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
                value={draft.totalPages}
                onChange={(event) => set('totalPages', event.target.value)}
                className={cn(
                  CONTROL_CLASS,
                  'tabular',
                  controlTone(Boolean(field['aria-invalid'])),
                )}
              />
            )}
          </Field>

          <Field label="ژانر" hint="اختیاری">
            {(field) => (
              <input
                {...field}
                type="text"
                value={draft.genre}
                onChange={(event) => set('genre', event.target.value)}
                className={cn(
                  CONTROL_CLASS,
                  'border-line hover:border-line-strong focus:border-accent',
                )}
              />
            )}
          </Field>
        </div>

        <CoverUpload
          value={draft.coverImage}
          onChange={(ref) => set('coverImage', ref)}
          bookTitle={draft.title}
        />

        <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-line bg-canvas px-4 text-sm text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink"
          >
            انصراف
          </button>
          <button
            type="submit"
            data-testid="edit-save"
            className={PRIMARY_BUTTON}
          >
            <Pencil aria-hidden="true" strokeWidth={2} className="size-4" />
            ذخیرهٔ تغییرات
          </button>
        </div>
      </form>
    </Modal>
  )
}

function validate(draft: Draft): Errors {
  const errors: Errors = {}

  if (!draft.title.trim()) errors.title = 'عنوان کتاب را وارد کنید.'
  if (!draft.author.trim()) errors.author = 'نام نویسنده را وارد کنید.'

  if (draft.isbn.trim()) {
    const digits = normalizeIsbn(draft.isbn.trim())
    if (!/^\d{9}[\dX]$|^\d{13}$/.test(digits)) {
      errors.isbn = 'شمارهٔ ISBN باید ۱۰ یا ۱۳ رقم باشد.'
    }
  }

  const year = draft.publishedYear.trim()
  if (year) {
    const maxYear = new Date().getFullYear() + 1
    if (!/^\d{4}$/.test(year) || Number(year) < 1000 || Number(year) > maxYear) {
      errors.publishedYear = 'سال انتشار معتبر نیست.'
    }
  }

  const pages = draft.totalPages.trim()
  if (pages && (!/^\d{1,5}$/.test(pages) || Number(pages) < 1)) {
    errors.totalPages = 'تعداد صفحات باید عددی مثبت باشد.'
  }

  return errors
}
