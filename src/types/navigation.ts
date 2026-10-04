import type { LucideIcon } from 'lucide-react'

/**
 * A sidebar destination.
 *
 * `path` is already a router-ready URL so that adding a real router later is a
 * drop-in change: swap the `<button>` in `SidebarNavItem` for a router link and
 * the whole navigation keeps working.
 */
export interface NavItem {
  id: string
  /** Persian label. */
  label: string
  /** Short Persian gloss shown under the label in the expanded rail. */
  description?: string
  path: string
  icon: LucideIcon
  /** Shown as a small pill — used to hint at "coming soon" sections. */
  isPlaceholder?: boolean
}

/** Identifier of the active destination. */
export type NavItemId =
  | 'home'
  | 'library'
  | 'notes'
  | 'quotes'
  | 'insights'
  | 'settings'
