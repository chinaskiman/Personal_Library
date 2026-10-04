import { TriangleAlert } from 'lucide-react'

/**
 * Explains that changes are not being saved.
 *
 * Storage can fail for reasons the user cannot guess — private browsing, a full
 * quota, or blocked site data — so the message names the consequence rather than
 * the cause. Writes are best-effort, which makes a silent warning easy to miss;
 * this is the one place that tells them their work is at risk.
 */
export function PersistenceWarning({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <p
      role="status"
      className="mt-8 flex items-start gap-2.5 rounded-lg border border-status-dropped/30 bg-status-dropped/5 px-4 py-3 text-[0.8rem] leading-relaxed text-ink-soft"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-status-dropped"
      />
      <span>
        <span className="font-medium text-ink">ذخیره‌سازی در دسترس نیست.</span>{' '}
        تغییرات شما در این مرورگر نگه‌داری نمی‌شود و با بستن یا به‌روزرسانی صفحه از
        بین می‌رود. اگر حالت ناشناس یا محدودکنندهٔ داده فعال است، آن را بررسی کنید.
      </span>
    </p>
  )
}