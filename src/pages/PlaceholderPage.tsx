import { Compass } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { SectionHeading } from '@/components/common/SectionHeading'
import { navItemById } from '@/data/navigation'
import type { NavItemId } from '@/types/navigation'

export interface PlaceholderPageProps {
  itemId: NavItemId
}

/**
 * Placeholder for sections that are not built yet.
 * Gives the shell a real destination to render while keeping scope honest.
 */
export function PlaceholderPage({ itemId }: PlaceholderPageProps) {
  const item = navItemById(itemId)

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="به‌زودی"
        title={item.label}
        description={item.description}
      />
      <EmptyState
        icon={item.icon ?? Compass}
        title={`بخش «${item.label}» هنوز ساخته نشده است`}
        description="این بخش در گام‌های بعدی پروژه پیاده‌سازی می‌شود. ساختار پوسته و مسیریابی برای افزودن آن آماده است."
      />
    </div>
  )
}
