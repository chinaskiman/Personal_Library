import { BookOpen } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppSidebar } from '@/components/navigation/AppSidebar'
import { MobileNavBar } from '@/components/navigation/MobileNavBar'
import { TopBar } from '@/components/navigation/TopBar'
import type { NavItem, NavItemId } from '@/types/navigation'

export interface AppShellProps {
  children: ReactNode
  activeItemId: NavItemId
  onNavigate: (item: NavItem) => void
  searchValue: string
  onSearchChange: (value: string) => void
  onAddBook: () => void
}

/**
 * Application shell: fixed RTL sidebar + sticky top bar + main region.
 *
 * The main region is offset with `padding-inline-start` (Tailwind's `ps-*`),
 * so the layout flips correctly if the document direction ever changes — no
 * hard-coded `margin-right` anywhere.
 */
export function AppShell({
  children,
  activeItemId,
  onNavigate,
  searchValue,
  onSearchChange,
  onAddBook,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only absolute start-4 top-4 z-50 rounded-md border border-accent bg-canvas px-4 py-2 text-sm text-ink shadow-soft"
      >
        پرش به محتوای اصلی
      </a>

      <AppSidebar activeItemId={activeItemId} onNavigate={onNavigate} />

      <div className="flex min-h-dvh flex-col md:ps-[var(--app-sidebar-current)]">
        <MobileNavBar activeItemId={activeItemId} onNavigate={onNavigate} />
        <TopBar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onAddBook={onAddBook}
        />

        <main
          id="main-content"
          className="flex-1 px-gutter pt-8 pb-16 lg:pt-10"
        >
          <div className="mx-auto w-full max-w-[80rem]">{children}</div>
        </main>

        <footer className="border-t border-line px-gutter py-6">
          <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-2 text-[0.72rem] text-ink-faint">
            <p>«خانه» — نمای کلی دفتر مطالعهٔ شما</p>
            <p className="inline-flex items-center gap-1.5">
              <BookOpen aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              ساخته‌شده برای خواندن
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
