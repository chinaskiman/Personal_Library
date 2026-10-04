import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface GlobalSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** `lg` for the top bar, `xl` for the dashboard hero. */
  size?: 'lg' | 'xl'
  /** Right-aligned (inline-end) hint, e.g. «Enter». */
  hint?: string
  autoFocus?: boolean
}

/**
 * Global search field.
 *
 * Uses a real `<label>` (visually hidden) for accessibility, and a logical
 * `start` padding so the icon sits on the right in RTL and the left in LTR.
 */
export function GlobalSearch({
  value,
  onChange,
  placeholder = 'جست‌وجوی کتاب، نویسنده یا نقل‌قول…',
  className,
  size = 'lg',
  hint,
  autoFocus,
}: GlobalSearchProps) {
  const isLarge = size === 'xl'

  return (
    <div className={cn('relative w-full', className)}>
      <label htmlFor="global-search" className="sr-only">
        جست‌وجو در کتابخانه
      </label>
      <Search
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          'pointer-events-none absolute inset-y-0 start-0 my-auto size-4 text-ink-faint',
          isLarge ? 'start-5' : 'start-3.5',
        )}
      />
      <input
        id="global-search"
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-line bg-surface-raised text-ink',
          'placeholder:text-ink-faint',
          'transition-colors duration-200 ease-editorial',
          'hover:border-line-strong',
          'focus:border-accent focus:outline-none focus-visible:outline-none',
          'focus:ring-2 focus:ring-accent/25',
          isLarge
            ? 'h-13 ps-12 pe-5 text-base'
            : 'h-10 ps-10 pe-3 text-sm',
          // Reserve room for the keyboard hint so it never sits on the border.
          hint && (isLarge ? 'pe-16' : 'pe-14'),
        )}
      />
      {hint ? (
        <kbd
          aria-hidden="true"
          className={cn(
            // Centred with a translate rather than `inset-y-0` + `my-auto`,
            // which are contradictory vertical constraints.
            'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-xs',
            'border border-line bg-surface px-1.5 py-0.5 font-sans text-[0.65rem] leading-none text-ink-faint',
            isLarge ? 'end-5' : 'end-3',
          )}
        >
          {hint}
        </kbd>
      ) : null}
    </div>
  )
}
