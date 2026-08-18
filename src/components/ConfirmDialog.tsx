import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm action as destructive (default true for this component). */
  destructive?: boolean
  /** Disables Escape, backdrop dismiss, and confirm while an operation is in flight. */
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accessible confirmation dialog for destructive record actions.
 * Backdrop click and Escape cancel when not pending; they never confirm.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const confirmGuardRef = useRef(false)

  useLayoutEffect(() => {
    if (!open) {
      confirmGuardRef.current = false
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    confirmGuardRef.current = false

    // Defer past the triggering pointer/keyboard activation so focus is not stolen back.
    const timeoutId = window.setTimeout(() => {
      cancelRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!open) return

    const getFocusable = () => {
      const root = dialogRef.current
      if (!root) return [] as HTMLElement[]
      return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
      )
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!open) return

      if (event.key === 'Escape') {
        if (pending) return
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !dialogRef.current?.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !dialogRef.current?.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const previous = previousFocusRef.current
      if (previous && document.contains(previous)) {
        previous.focus()
      }
    }
  }, [open, pending, onCancel])

  if (!open) return null

  const handleConfirm = () => {
    if (pending || confirmGuardRef.current) return
    confirmGuardRef.current = true
    onConfirm()
  }

  const handleBackdropPointerDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (pending) return
    onCancel()
  }

  return createPortal(
    // Backdrop is a mouse/touch dismiss scrim only; keyboard users cancel with Escape or Cancel.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- non-interactive scrim; Escape remains the keyboard path
    <div className="confirm-dialog-backdrop" onMouseDown={handleBackdropPointerDown}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId} className="confirm-dialog-title">{title}</h2>
        <p id={descriptionId} className="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            className="secondary-command"
            type="button"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={destructive ? 'primary-command confirm-dialog-confirm is-destructive' : 'primary-command'}
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? `${confirmLabel}...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
