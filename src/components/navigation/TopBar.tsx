import { AddBookButton } from '@/components/common/AddBookButton'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { APP_CONFIG } from '@/config/app'
import { cn } from '@/lib/cn'

export interface TopBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onAddBook: () => void
  className?: string
}

/**
 * Sticky top navigation bar: global search, add-book action, profile.
 */
export function TopBar({
  searchValue,
  onSearchChange,
  onAddBook,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        // Static below `md` so it doesn't fight the mobile nav bar for the
        // sticky top edge; pinned once the sidebar takes over.
        'flex h-topbar items-center gap-4 md:sticky md:top-0',
        'border-b border-line bg-canvas/85 px-gutter backdrop-blur-md',
        className,
      )}
    >
      {/* Global search — grows to fill available space. */}
      <div className="flex min-w-0 flex-1 items-center">
        <div className="w-full max-w-md">
          <TopBarSearch value={searchValue} onChange={onSearchChange} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AddBookButton onClick={onAddBook} />

        <button
          type="button"
          aria-label="اعلان‌ها"
          className="hidden size-10 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-soft transition-colors duration-200 hover:border-line-strong hover:text-ink lg:flex"
        >
          <Bell aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </button>

        <ProfilePlaceholder />
      </div>
    </header>
  )
}

/* --- internals kept small and local to the bar --- */

function TopBarSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative w-full">
      <label htmlFor="topbar-search" className="sr-only">
        جست‌وجو در کتابخانه
      </label>
      <Search
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-ink-faint"
      />
      <input
        id="topbar-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="جست‌وجو در کتابخانه…"
        className={cn(
          'h-10 w-full rounded-md border border-line bg-surface-raised ps-10 pe-3 text-sm text-ink',
          'placeholder:text-ink-faint',
          'transition-colors duration-200 ease-editorial hover:border-line-strong',
          'focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none',
        )}
      />
    </div>
  )
}

function ProfilePlaceholder() {
  return (
    <button
      type="button"
      className={cn(
        'group inline-flex h-10 items-center gap-2 rounded-md border border-transparent ps-1 pe-2',
        'transition-colors duration-200 ease-editorial',
        'hover:border-line hover:bg-surface-raised',
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-serif text-[0.7rem] font-semibold text-accent"
      >
        DK
      </span>
      <span className="hidden min-w-0 text-start lg:block">
        <span className="block truncate text-[0.8rem] leading-tight font-medium text-ink">
          {APP_CONFIG.owner}
        </span>
        <span className="block truncate text-[0.68rem] leading-tight text-ink-faint">
          حساب من
        </span>
      </span>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className="hidden size-3.5 text-ink-faint transition-transform duration-200 group-hover:translate-y-0.5 lg:block"
      />
    </button>
  )
}
