export interface StatusBadgeProps {
  label: string
  /** Dot colour class, e.g. `bg-status-reading`. */
  dotClassName: string
  /** Text colour class, e.g. `text-status-reading`. */
  className: string
  size?: 'sm' | 'md'
  classNameOverride?: string
}

/** Small pill used to show a book's reading status. */
export function StatusBadge({
  label,
  dotClassName,
  className,
  size = 'sm',
  classNameOverride,
}: StatusBadgeProps) {
  const sizing = size === 'sm' ? 'text-[0.7rem] px-2.5 py-0.5 gap-1.5' : 'text-xs px-3 py-1 gap-2'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border border-line-soft bg-surface-raised',
        sizing,
        className,
        classNameOverride ?? '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${dotClassName}`}
      />
      {label}
    </span>
  )
}
