import type { NavItem, NavItemId } from '@/types/navigation'
import { APP_CONFIG } from '@/config/app'
import { NAV_ITEMS } from '@/data/navigation'
import { cn } from '@/lib/cn'

export interface MobileNavBarProps {
  activeItemId: NavItemId
  onNavigate: (item: NavItem) => void
}

/**
 * Compact horizontal navigation shown only below the sidebar breakpoint
 * (`md`), so there is always a way to move between sections on small screens.
 */
export function MobileNavBar({ activeItemId, onNavigate }: MobileNavBarProps) {
  return (
    <nav
      aria-label="ناوبری اصلی"
      // No negative margin bleed here: this bar's parent carries no horizontal
      // padding, so `-mx-gutter` widened the nav by twice the gutter and pushed
      // the whole document sideways on small screens. `px-gutter` alone lines the
      // content up with `TopBar` and `main` below it.
      className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-gutter py-2 backdrop-blur-md md:hidden"
    >
      <p className="ltr mb-2 truncate font-serif text-sm font-semibold text-ink">
        {APP_CONFIG.name}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.id === activeItemId

          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onNavigate(item)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs',
                  'transition-colors duration-200 ease-editorial',
                  isActive
                    ? 'border-accent bg-accent text-canvas'
                    : 'border-line bg-surface-raised text-ink-soft',
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
