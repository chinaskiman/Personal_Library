import type { NavItem, NavItemId } from '@/types/navigation'
import { APP_CONFIG } from '@/config/app'
import { LtrText } from '@/components/common/LtrText'
import { NAV_ITEMS } from '@/data/navigation'
import { SidebarNavItem } from '@/components/navigation/SidebarNavItem'

export interface AppSidebarProps {
  activeItemId: NavItemId
  onNavigate: (item: NavItem) => void
}

/**
 * Fixed navigation rail.
 *
 * Because the document is RTL, "start" is the right edge — so the sidebar
 * docks on the right purely by using logical positioning, with no `right:`
 * anywhere. It collapses to an icon rail between 768–1023px.
 */
export function AppSidebar({ activeItemId, onNavigate }: AppSidebarProps) {
  return (
    <aside
      className="fixed inset-y-0 start-0 z-30 hidden w-[var(--app-sidebar-current)] flex-col border-e border-line bg-surface md:flex"
      aria-label="ناوبری اصلی"
    >
      {/* Wordmark — collapses to the monogram when the rail is narrow. */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 max-[1023px]:justify-center max-[1023px]:px-0">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-canvas font-serif text-base font-semibold text-accent"
        >
          R
        </span>
        <span className="min-w-0 max-[1023px]:hidden">
          <LtrText className="block truncate font-serif text-base leading-tight font-semibold text-ink">
            {APP_CONFIG.name}
          </LtrText>
          <span className="block truncate text-[0.7rem] text-ink-soft">
            {APP_CONFIG.tagline}
          </span>
        </span>
      </div>

      <div aria-hidden="true" className="rule-vertical mx-5 h-px max-[1023px]:mx-3" />

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      {/* Footer note — the rail is too narrow for it. */}
      <div className="border-t border-line px-5 py-4 max-[1023px]:hidden">
        <p className="text-[0.7rem] leading-relaxed text-ink-faint">
          نسخهٔ {APP_CONFIG.version}
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-faint">
          جایی آرام برای کتاب‌های شما
        </p>
      </div>
    </aside>
  )
}
