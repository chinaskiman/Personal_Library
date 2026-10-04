import type { NavItem } from '@/types/navigation'
import { cn } from '@/lib/cn'

export interface SidebarNavItemProps {
  item: NavItem
  isActive: boolean
  onNavigate: (item: NavItem) => void
}

/**
 * One sidebar destination.
 *
 * Currently a `<button>` with local state routing. To adopt a real router,
 * replace this with the router's `<Link to={item.path}>` and keep the classes.
 */
export function SidebarNavItem({
  item,
  isActive,
  onNavigate,
}: SidebarNavItemProps) {
  const Icon = item.icon

  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(item)}
        aria-current={isActive ? 'page' : undefined}
        data-testid={`nav-${item.id}`}
        title={item.label}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5',
          'text-start transition-colors duration-200 ease-editorial',
          // Below `lg` the sidebar becomes an icon rail, so centre the icon.
          'max-[1023px]:justify-center max-[1023px]:px-0',
          isActive
            ? 'bg-canvas text-ink shadow-paper'
            : 'text-ink-soft hover:bg-canvas-deep hover:text-ink',
        )}
      >
        {/* Active marker pinned to the inline-start edge. */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-2 start-0 w-0.5 rounded-full transition-opacity duration-200',
            isActive ? 'bg-accent opacity-100' : 'opacity-0',
          )}
        />

        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn(
            'size-[1.15rem] shrink-0 transition-colors duration-200',
            isActive ? 'text-accent' : 'text-ink-faint group-hover:text-accent',
          )}
        />

        <span className="min-w-0 flex-1 max-[1023px]:hidden">
          <span
            className={cn(
              'block truncate text-sm',
              isActive ? 'font-medium text-ink' : 'text-ink-soft',
            )}
          >
            {item.label}
          </span>
          {/* Description needs the full-width sidebar to breathe. */}
          <span className="mt-0.5 hidden truncate text-[0.7rem] leading-tight text-ink-faint xl:block">
            {item.description}
          </span>
        </span>
      </button>
    </li>
  )
}
