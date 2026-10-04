import type { ReactNode } from 'react'

export interface LtrTextProps {
  children: ReactNode
  /** Extra classes. */
  className?: string
  /** Semantic element to render. Defaults to `span`. */
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'cite'
  /** `lang` attribute so screen readers switch voice. Defaults to `en`. */
  lang?: string
  title?: string
}

/**
 * Isolates English content inside the Persian RTL interface.
 *
 * `unicode-bidi: isolate` (via the `ltr` utility) keeps the English run from
 * re-ordering neighbouring Persian punctuation, while `direction: ltr` makes
 * multi-word titles read naturally.
 */
export function LtrText({
  children,
  className,
  as: Tag = 'span',
  lang = 'en',
  title,
}: LtrTextProps) {
  return (
    <Tag className={`ltr ${className ?? ''}`} lang={lang} dir="ltr" title={title}>
      {children}
    </Tag>
  )
}
