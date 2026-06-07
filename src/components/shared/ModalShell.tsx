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
}: ModalShellProps) {
  const internalTrapRef = useFocusTrap(open, onClose)
  const trapRef = externalTrapRef ?? internalTrapRef

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`} role="presentation">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={trapRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={`relative w-full max-w-md rounded-2xl border border-white/10 bg-[#161620]/95 backdrop-blur-xl shadow-2xl ${panelClassName}`.trim()}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
