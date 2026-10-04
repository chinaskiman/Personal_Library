import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /**
   * Level for the title heading.
   *
   * An empty state is usually a section's content, so it sits under that
   * section's `h2` and the title is an `h3`. But on a page whose only content is
   * the empty state, it follows the page `h1` directly and an `h3` would skip a
   * level, so callers can ask for `2`.
   */
  headingLevel?: 2 | 3
  /** Optional action row, e.g. a "clear search" or "add book" button. */
  action?: ReactNode
  className?: string
}

/** Calm, centred empty state. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  headingLevel = 3,
  action,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line',
        'bg-surface/40 px-8 py-16 text-center',
        className ?? '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full border border-line bg-canvas"
      >
        <Icon strokeWidth={1.25} className="size-5 text-accent" />
      </span>
      <Heading className="mt-5 text-base font-semibold text-ink">{title}</Heading>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
      {action}
    </div>
  )
}
