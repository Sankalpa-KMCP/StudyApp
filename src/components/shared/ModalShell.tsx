import type { ReactNode, Ref } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ModalShellProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  panelClassName?: string
  zIndexClass?: string
  role?: 'dialog' | 'alertdialog'
  ariaLabelledby?: string
  ariaDescribedby?: string
  ariaLabel?: string
  trapRef?: Ref<HTMLDivElement>
  closeOnBackdrop?: boolean
}

export function ModalShell({
  open,
  onClose,
  children,
  panelClassName = '',
  zIndexClass = 'z-50',
  role = 'dialog',
  ariaLabelledby,
  ariaDescribedby,
  ariaLabel,
  trapRef: externalTrapRef,
  closeOnBackdrop = true,
}: ModalShellProps) {
  const internalTrapRef = useFocusTrap(open, onClose)
  const trapRef = externalTrapRef ?? internalTrapRef

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`} role="presentation">
      <button
        type="button"
        className="absolute inset-0 modal-backdrop backdrop-blur-md border-0 p-0 cursor-default"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div
        ref={trapRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={`relative w-full max-w-md rounded-2xl border border-card surface-overlay shadow-2xl ${panelClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  )
}
