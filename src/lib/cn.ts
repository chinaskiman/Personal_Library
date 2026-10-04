/**
 * Conditional className joiner — avoids pulling in a dependency for
 * something this small.
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}
