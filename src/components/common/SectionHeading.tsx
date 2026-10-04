import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionHeadingProps {
  /** Persian section title. */
  title: string
  /**
   * Heading level for the title.
   *
   * Most callers are naming a section within a page, so `h2` is right. A page
   * whose heading is this element rather than a separate masthead passes `1`, so
   * the document still has exactly one `h1` and no level is skipped.
   */
  level?: 1 | 2
  /** Optional Persian supporting line. */
  description?: string
  /** Optional trailing element (e.g. a link or a filter). */
  action?: ReactNode
  /** Small letter-spaced label above the title. */
  eyebrow?: string
  className?: string
}

/** Editorial section header: eyebrow, title, description, optional action. */
export function SectionHeading({
  title,
  description,
  action,
  eyebrow,
  level = 2,
  className,
}: SectionHeadingProps) {
  const Heading = level === 1 ? 'h1' : 'h2'

  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[0.68rem] font-medium tracking-[0.18em] text-ink-faint uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Heading className="text-lg font-semibold text-ink sm:text-xl">
          {title}
        </Heading>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
