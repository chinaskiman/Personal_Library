import { useEffect, useId, useState } from 'react'
import { Quote as QuoteIcon, Save, Type, X, ImageIcon } from 'lucide-react'

import { PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { CoverUpload } from '@/components/common/CoverUpload'
import { CONTROL_CLASS, Field, controlTone } from '@/components/common/Field'
import { cn } from '@/lib/cn'
import {
  NOTE_TYPE_META,
  NOTE_TYPE_ORDER,
  type Note,
  type NoteType,
} from '@/types/note'

const TYPE_ICONS: Record<NoteType, typeof Type> = {
  text: Type,
  quote: QuoteIcon,
  image: ImageIcon,
}

export interface NoteEditorProps {
  bookId: string
  /** Supplying a note puts the editor into edit mode. */
  note?: Note
  onSubmit: (draft: Omit<Note, 'id' | 'bookId' | 'createdAt'>) => void
  onCancel: () => void
}

interface Draft {
  type: NoteType
  content: string
  page: string
  imageRef?: string
}

const EMPTY: Draft = { type: 'text', content: '', page: '', imageRef: undefined }

/**
 * Plain-text journal editor.
 *
 * Deliberately not a rich-text editor: plain text keeps entries portable and
 * screen-reader friendly. Validation is explicit but minimal — a body is
 * required for text and quote notes, an image is required for image notes.
 */
export function NoteEditor({
  bookId,
  note,
  onSubmit,
  onCancel,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const headingId = useId()
  const isEditing = Boolean(note)

  // Reset when the editor is pointed at a different note (or none).
  useEffect(() => {
    setDraft(
      note
        ? {
            type: note.type,
            content: note.content,
            page: note.page ? String(note.page) : '',
            imageRef: note.imageRef,
          }
        : EMPTY,
    )
    setError(null)
  }, [note])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const current = NOTE_TYPE_META[draft.type]
    if (current.requiresContent && !draft.content.trim()) {
      setError(
        draft.type === 'quote' ? 'متن نقل‌قول را بنویسید.' : 'متن یادداشت را بنویسید.',
      )
      return
    }
    if (draft.type === 'image' && !draft.imageRef) {
      setError('برای یادداشت تصویری، یک تصویر انتخاب کنید.')
      return
    }

    const page = draft.page.trim()
    if (page && !/^\d{1,5}$/.test(page)) {
      setError('شمارهٔ صفحه باید عددی مثبت باشد.')
      return
    }

    setError(null)
    onSubmit({
      type: draft.type,
      content: draft.content.trim(),
      page: page ? Number(page) : undefined,
      imageRef: draft.type === 'image' ? draft.imageRef : undefined,
    })
  }

  const meta = NOTE_TYPE_META[draft.type]

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={headingId}
      data-testid="note-editor"
      data-book-id={bookId}
      className="rounded-lg border border-line bg-surface-raised p-4"
    >
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {isEditing ? 'ویرایش یادداشت' : 'یادداشت تازه'}
      </h3>

      {/* Type picker as radios: arrow keys move between options and the group
          is announced as a single choice. */}
      <fieldset className="mt-3 space-y-1.5">
        <legend className="text-[0.8rem] font-medium text-ink">نوع</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {NOTE_TYPE_ORDER.map((type) => {
            const Icon = TYPE_ICONS[type]
            const selected = draft.type === type
            return (
              <label
                key={type}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2',
                  'transition-colors duration-200 ease-editorial',
                  // The radio itself is visually hidden, so the label carries
                  // the focus ring — otherwise keyboard focus would be invisible.
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50',
                  selected
                    ? 'border-accent bg-accent-wash/50'
                    : 'border-line bg-canvas hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="note-type"
                  value={type}
                  checked={selected}
                  onChange={() => {
                    set('type', type)
                    setError(null)
                  }}
                  className="sr-only"
                />
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={cn(
                    'size-3.5 shrink-0',
                    selected ? 'text-accent' : 'text-ink-faint',
                  )}
                />
                <span
                  className={cn(
                    'text-[0.8rem]',
                    selected ? 'font-medium text-ink' : 'text-ink-soft',
                  )}
                >
                  {NOTE_TYPE_META[type].label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <p className="mt-2 text-[0.72rem] text-ink-faint">{meta.hint}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field
          label={draft.type === 'image' ? 'توضیح تصویر' : 'متن'}
          required={meta.requiresContent}
        >
          {(field) => (
            <textarea
              {...field}
              rows={draft.type === 'image' ? 2 : draft.type === 'quote' ? 4 : 5}
              value={draft.content}
              // Notes may be Persian or English; `dir="auto"` picks the right
              // base direction from the first strong character.
              dir="auto"
              onChange={(event) => set('content', event.target.value)}
              placeholder={
                draft.type === 'image'
                  ? 'توضیحی کوتاه دربارهٔ این لحظهٔ خواندن…'
                  : draft.type === 'quote'
                    ? 'جمله‌ای که می‌خواهید به خاطر بسپارید…'
                    : 'در این کتاب چه خواندید؟'
              }
              className={cn(
                CONTROL_CLASS,
                'resize-y leading-[2]',
                // A quote reads best in the serif face.
                draft.type === 'quote' && 'font-serif text-[0.95rem]',
                controlTone(Boolean(error)),
              )}
            />
          )}
        </Field>

        <Field label="صفحه" hint="اختیاری">
          {(field) => (
            <input
              {...field}
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={draft.page}
              onChange={(event) => set('page', event.target.value)}
              placeholder="123"
              className={cn(CONTROL_CLASS, 'tabular text-center')}
            />
          )}
        </Field>
      </div>

      {draft.type === 'image' ? (
        <div className="mt-4">
          <CoverUpload
            value={draft.imageRef}
            onChange={(ref) => {
              set('imageRef', ref)
              setError(null)
            }}
            bookTitle={draft.content || 'یادداشت تصویری'}
          />
        </div>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-3 text-[0.75rem] leading-relaxed',
          error ? 'text-status-dropped' : 'sr-only',
        )}
      >
        {error ?? ''}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-canvas px-3.5 text-[0.8rem] text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          <X aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          انصراف
        </button>
        <button
          type="submit"
          data-testid="note-save"
          className={PRIMARY_BUTTON}
        >
          <Save aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          {isEditing ? 'ذخیرهٔ تغییرات' : 'افزودن یادداشت'}
        </button>
      </div>
    </form>
  )
}
