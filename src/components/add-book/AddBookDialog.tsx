import { useId, useState } from 'react'
import { Info } from 'lucide-react'

import { BookSearchTab } from '@/components/add-book/BookSearchTab'
import { ManualEntryTab } from '@/components/add-book/ManualEntryTab'
import { Modal } from '@/components/common/Modal'
import { findDuplicate } from '@/lib/library'
import { cn } from '@/lib/cn'
import type { AddBookResult, Book, NewBookInput } from '@/types/book'
import type { AddBookTab, CatalogBook } from '@/types/catalog'

export interface AddBookDialogProps {
  open: boolean
  onClose: () => void
  /** Current library, used for duplicate detection and "already added" hints. */
  books: Book[]
  /** Receives the new book and reports whether it was accepted. */
  onAdd: (input: NewBookInput) => AddBookResult
  /** Called after a successful add so the caller can confirm to the user. */
  onAdded?: (book: Book) => void
}

const TABS: readonly { id: AddBookTab; label: string }[] = [
  { id: 'search', label: 'جست‌وجوی کتاب' },
  { id: 'manual', label: 'ثبت دستی' },
] as const

/**
 * Add-book dialog with a search tab and a manual-entry tab.
 *
 * Added books are written through to local persistence, so the footer tells the
 * user where their data lives rather than implying it is temporary.
 */
export function AddBookDialog({
  open,
  onClose,
  books,
  onAdd,
  onAdded,
}: AddBookDialogProps) {
  const [tab, setTab] = useState<AddBookTab>('search')
  const [notice, setNotice] = useState<string | null>(null)
  const tablistId = useId()

  const handleAdd = (input: NewBookInput): AddBookResult => {
    const result = onAdd(input)
    if (result.ok) {
      onAdded?.(result.book)
      setNotice(null)
      onClose()
    } else {
      setNotice(
        `«${result.existing.title}» از پیش در کتابخانه هست؛ دوباره افزوده نشد.`,
      )
    }
    return result
  }

  const isInLibrary = (book: CatalogBook) =>
    findDuplicate(books, {
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      status: 'want-to-read',
    }) !== null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="افزودن کتاب"
      description="کتابی را از فهرست نمونه انتخاب کنید یا اطلاعاتش را دستی وارد کنید."
      footer={
        <p className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-ink-faint">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            کتاب‌هایی که اضافه می‌کنید در همین مرورگر ذخیره می‌شوند و با بازخوانی
            صفحه باقی می‌مانند؛ پاک‌کردن داده‌های سایت آن‌ها را حذف می‌کند.
          </span>
        </p>
      }
    >
      <div className="space-y-5">
        {/* Tabs follow the WAI-ARIA tabs pattern with manual activation, so
            arrow keys move focus without unexpectedly swapping panels. */}
        <div
          role="tablist"
          aria-label="روش افزودن کتاب"
          className="flex gap-1 border-b border-line"
        >
          {TABS.map((item) => {
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-testid={`tab-${item.id}`}
                id={`${tablistId}-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(item.id)
                  setNotice(null)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                  event.preventDefault()
                  const index = TABS.findIndex((entry) => entry.id === tab)
                  const delta = event.key === 'ArrowLeft' ? 1 : -1
                  const next =
                    TABS[(index + delta + TABS.length) % TABS.length] ?? TABS[0]
                  setTab(next.id)
                  document
                    .getElementById(`${tablistId}-tab-${next.id}`)
                    ?.focus()
                }}
                className={cn(
                  '-mb-px border-b-2 px-3.5 py-2 text-[0.85rem] transition-colors duration-200',
                  selected
                    ? 'border-accent font-medium text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {notice ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface/70 px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-ink-soft">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
            {notice}
          </p>
        ) : null}
{TABS.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${tablistId}-panel-${item.id}`}
            aria-labelledby={`${tablistId}-tab-${item.id}`}
            hidden={tab !== item.id}
            tabIndex={0}
            className="focus-visible:outline-none"
          >
            {item.id === 'search' ? (
              <BookSearchTab onAdd={handleAdd} isInLibrary={isInLibrary} />
            ) : (
              <ManualEntryTab onSubmit={handleAdd} />
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}