import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Image as ImageIcon,
  Plus,
  Quote as QuoteIcon,
  Type,
} from 'lucide-react'

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/common/buttonStyles'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { NoteCard } from '@/components/journal/NoteCard'
import { NoteEditor } from '@/components/journal/NoteEditor'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import {
  NOTE_TYPE_META,
  NOTE_TYPE_ORDER,
  type Note,
  type NoteFilter,
} from '@/types/note'

const FILTER_ICONS = {
  text: Type,
  quote: QuoteIcon,
  image: ImageIcon,
} as const

export interface JournalSectionProps {
  bookId: string
  /** Notes for this book, already ordered newest first. */
  notes: Note[]
  onCreate: (draft: Omit<Note, 'id' | 'bookId' | 'createdAt'>) => void
  onUpdate: (id: string, patch: Partial<Omit<Note, 'id' | 'bookId'>>) => void
  onDelete: (id: string) => void
  /**
   * Note to reveal on arrival, used when arriving from the Notes library.
   * It also relaxes the active filter, since the target may be hidden by it.
   */
  focusNoteId?: string | null
}

/**
 * The reading journal for one book.
 *
 * There is no cap on how many entries a book can hold — the list simply grows.
 * Editing happens in place, replacing the card with the editor, so the user
 * never loses their place in the chronology.
 */
export function JournalSection({
  bookId,
  notes,
  onCreate,
  onUpdate,
  onDelete,
  focusNoteId = null,
}: JournalSectionProps) {
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<NoteFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  // Arriving with a target note means the user wants to see that entry, so the
  // type filter is relaxed if it would otherwise hide it. Runs in an effect
  // (not during render) and keys on the target so it fires once per arrival.
  useEffect(() => {
    if (!focusNoteId) return
    const target = notes.find((note) => note.id === focusNoteId)
    if (target && filter !== 'all' && target.type !== filter) setFilter('all')
  }, [focusNoteId, notes, filter])

  const counts = useMemo(() => {
    const base: Record<NoteFilter, number> = {
      all: notes.length,
      text: 0,
      quote: 0,
      image: 0,
    }
    for (const note of notes) base[note.type] += 1
    return base
  }, [notes])

  const visible = useMemo(
    () => (filter === 'all' ? notes : notes.filter((note) => note.type === filter)),
    [notes, filter],
  )

  const filters: readonly { id: NoteFilter; label: string }[] = [
    { id: 'all', label: 'همه' },
    ...NOTE_TYPE_ORDER.map((type) => ({
      id: type,
      label: NOTE_TYPE_META[type].label,
    })),
  ]
return (
    <section aria-labelledby="journal-heading" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2
            id="journal-heading"
            className="font-serif text-xl font-semibold text-ink sm:text-2xl"
          >
            دفتر خواندن
          </h2>
          <p className="tabular mt-1.5 text-sm text-ink-soft">
            {formatNumber(notes.length)} یادداشت ثبت شده
            {counts.quote > 0 ? ` · ${formatNumber(counts.quote)} نقل‌قول` : ''}
          </p>
        </div>

        {!composing && !editingId ? (
          <button
            type="button"
            data-testid="note-new"
            onClick={() => setComposing(true)}
            className={PRIMARY_BUTTON}
          >
            <Plus aria-hidden="true" strokeWidth={2} className="size-3.5" />
            یادداشت تازه
          </button>
        ) : null}
      </header>

      {composing ? (
        <NoteEditor
          bookId={bookId}
          onSubmit={(draft) => {
            onCreate(draft)
            setComposing(false)
          }}
          onCancel={() => setComposing(false)}
        />
      ) : null}

      {/* Type filter — only worth showing once there is something to filter. */}
      {notes.length > 0 ? (
        <div
          role="group"
          aria-label="فیلتر یادداشت‌ها"
          className="flex flex-wrap gap-2"
        >
          {filters.map((entry) => {
            const active = filter === entry.id
            const Icon = entry.id === 'all' ? null : FILTER_ICONS[entry.id]
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                data-testid={`note-filter-${entry.id}`}
                onClick={() => setFilter(entry.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
                  'text-[0.75rem] transition-colors duration-200 ease-editorial',
                  active
                    ? 'border-accent bg-accent text-canvas'
                    : 'border-line bg-surface-raised text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {Icon ? (
                  <Icon aria-hidden="true" strokeWidth={1.5} className="size-3" />
                ) : null}
                {entry.label}
                <span
                  className={cn(
                    'tabular',
                    active ? 'text-canvas/75' : 'text-ink-faint',
                  )}
                >
                  {formatNumber(counts[entry.id])}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="دفتر این کتاب هنوز خالی است"
          description="هر جمله‌ای که می‌خواهید به یاد بسپارید، یا هر فکری که این کتاب در شما برانگیخت، جای خوبی برای ثبت کردن دارد."
          className="py-14"
          action={
            !composing ? (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className={cn('mt-5', PRIMARY_BUTTON)}
              >
                <Plus aria-hidden="true" strokeWidth={2} className="size-3.5" />
                نخستین یادداشت
              </button>
            ) : null
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="یادداشتی از این نوع نیست"
          description="فیلتر را روی «همه» بگذارید تا همهٔ یادداشت‌های این کتاب را ببینید."
          className="py-12"
          action={
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn('mt-5', SECONDARY_BUTTON)}
            >
              دیدن همهٔ یادداشت‌ها
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((note) =>
            editingId === note.id ? (
              <NoteEditor
                key={note.id}
                bookId={bookId}
                note={note}
                onSubmit={(draft) => {
                  onUpdate(note.id, draft)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                highlighted={note.id === focusNoteId}
                onEdit={(target) => {
                  setComposing(false)
                  setEditingId(target.id)
                }}
                onDelete={(target) => setPendingDelete(target)}
              />
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف یادداشت"
        description="این یادداشت برای همیشه حذف می‌شود. اگر تصویری داشته باشد، آن هم پاک می‌گردد."
        confirmLabel="حذف یادداشت"
        destructive
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
