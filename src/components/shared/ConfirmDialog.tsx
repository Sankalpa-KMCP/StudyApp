import { useFocusTrap } from '../../hooks/useFocusTrap'
import { Button } from './Button'
import { ModalShell } from './ModalShell'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const trapRef = useFocusTrap(open, onCancel)

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      role="alertdialog"
      zIndexClass="z-[110]"
      ariaLabelledby="confirm-dialog-title"
      ariaDescribedby="confirm-dialog-desc"
      trapRef={trapRef}
      panelClassName="p-6"
    >
      <h2 id="confirm-dialog-title" className="text-sm font-bold text-primary mb-2">{title}</h2>
      <p id="confirm-dialog-desc" className="text-caption text-secondary leading-relaxed mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} size="md" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  )
}
