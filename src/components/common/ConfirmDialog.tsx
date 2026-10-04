import { DESTRUCTIVE_BUTTON, PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { Modal } from '@/components/common/Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  /** Destructive actions get the muted red treatment. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Yes/no confirmation.
 *
 * Uses the shared `Modal`, so focus trapping, Escape-to-close and focus
 * restoration come for free. Focus lands on *cancel*, not confirm — a
 * destructive action must never be the default the Enter key fires.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'انصراف',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      className="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line bg-canvas px-4 text-[0.8rem] text-ink transition-colors duration-200 hover:border-line-strong"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-action"
            onClick={onConfirm}
            className={destructive ? DESTRUCTIVE_BUTTON : PRIMARY_BUTTON}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
    </Modal>
  )
}