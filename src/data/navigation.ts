import {
  ChartColumn,
  House,
  Library,
  NotebookPen,
  Quote,
  Settings,
} from 'lucide-react'
import type { NavItem, NavItemId } from '@/types/navigation'

/**
 * Sidebar destinations, in reading order (top to bottom).
 * `path` values are router-ready; a real router can be dropped in later.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'home',
    label: 'خانه',
    description: 'نمای کلی روز',
    path: '/',
    icon: House,
  },
  {
    id: 'library',
    label: 'کتابخانه',
    description: 'همهٔ کتاب‌ها',
    path: '/library',
    icon: Library,
  },
  {
    id: 'notes',
    label: 'یادداشت‌ها',
    description: 'درون‌یادداشت‌ها',
    path: '/notes',
    icon: NotebookPen,
  },
  {
    id: 'quotes',
    label: 'نقل‌قول‌ها',
    description: 'جمله‌های ماندگار',
    path: '/quotes',
    icon: Quote,
  },
  {
    id: 'insights',
    label: 'آمار مطالعه',
    description: 'روند و آمار',
    path: '/insights',
    icon: ChartColumn,
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    description: 'ترجیحات',
    path: '/settings',
    icon: Settings,
  },
] as const

/** Resolve the active navigation item from its id. */
export function navItemById(id: NavItemId): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.id === id)
  if (!item) throw new Error(`Unknown navigation item: ${id}`)
  return item
}
