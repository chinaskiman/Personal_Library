import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AddBookButtonProps {
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  className?: string
}

/**
 * Primary "add book" action.
 * The icon is rendered before the label so it appears on the right in RTL.
 */
export function AddBookButton({
  onClick,
  variant = 'primary',
  className,
}: AddBookButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="add-book-button"
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-md text-sm font-medium',
        'transition-all duration-200 ease-editorial',
        isPrimary
          ? 'h-10 border border-accent bg-accent px-4 text-canvas hover:bg-accent-strong hover:border-accent-strong'
          : 'h-9 border border-line bg-surface-raised px-3.5 text-ink hover:border-line-strong hover:bg-canvas-deep',
        className,
      )}
    >
      <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
      {/* The label collapses to an icon-only button on narrow viewports. */}
      <span className="hidden sm:inline">افزودن کتاب</span>
      <span className="sr-only sm:hidden">افزودن کتاب</span>
    </button>
  )
}
