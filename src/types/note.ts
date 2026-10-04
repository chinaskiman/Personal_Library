import type { ReadingStatus } from './book'

/**
 * Kind of journal entry.
 *
 * `text` is a reflection, `quote` a quotation rendered distinctly, and `image`
 * a visual moment that may also carry a short caption. Every type may carry an
 * optional page reference.
 */
export type NoteType = 'text' | 'quote' | 'image'

/**
 * One entry in a book's reading journal.
 *
 * Notes are owned by a book via `bookId`, never stored globally, so deleting a
 * book can cascade to exactly its own entries.
 */
export interface Note {
  /** Stable, unique id. Prefixed `note-` for easy debugging in storage. */
  id: string
  /** Owning book. */
  bookId: string
  type: NoteType
  /** Body text. Required for `text`/`quote`; an optional caption for `image`. */
  content: string
  /** 1-based page the entry refers to. */
  page?: number
  /** `idb:<key>` reference for `image` notes. */
  imageRef?: string
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of the last edit. Absent until first edited. */
  updatedAt?: string
}

/** Payload accepted by the note editor. */
export interface NewNoteInput {
  bookId: string
  type: NoteType
  content: string
  page?: number
  imageRef?: string
}

/** Persian label and icon-free presentation metadata per note type. */
export interface NoteTypeMeta {
  label: string
  /** One-line guidance shown in the editor. */
  hint: string
  /** Whether a body is mandatory. */
  requiresContent: boolean
}

export const NOTE_TYPE_META: Record<NoteType, NoteTypeMeta> = {
  text: {
    label: 'یادداشت',
    hint: 'در چند خط بنویسید این کتاب چه چیزی در شما به‌جا گذاشت.',
    requiresContent: true,
  },
  quote: {
    label: 'نقل‌قول',
    hint: 'جمله‌ای که می‌خواهید به خاطر بسپارید را عیناً بنویسید.',
    requiresContent: true,
  },
  image: {
    label: 'تصویر',
    hint: 'تصویری از این لحظهٔ خواندن، با توضیحی کوتاه.',
    requiresContent: false,
  },
}

/** Display order for the type filter. */
export const NOTE_TYPE_ORDER: readonly NoteType[] = [
  'text',
  'quote',
  'image',
] as const

/** Filter state of the journal list. `all` shows every entry. */
export type NoteFilter = 'all' | NoteType

/** Re-exported so note modules need only one import for status-aware code. */
export type { ReadingStatus }