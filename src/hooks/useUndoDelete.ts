import { useCallback, useRef } from 'react'
import type { ToastAction } from '../types/app'

const UNDO_DURATION_MS = 5000

interface UndoToastApi {
  setActiveToast: (toast: {
    key: string
    message: string
    id: number
    action?: ToastAction
    durationMs?: number
  } | null) => void
}

export function useUndoDelete(toast: UndoToastApi) {
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }, [])

  const scheduleDelete = useCallback((
    itemLabel: string,
    onCommit: () => void | Promise<void>,
    onUndo: () => void | Promise<void>,
  ) => {
    clearPending()
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null
      void onCommit()
    }, UNDO_DURATION_MS)

    toast.setActiveToast({
      key: 'UNDO',
      message: `${itemLabel} deleted`,
      id: Date.now(),
      durationMs: UNDO_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          clearPending()
          toast.setActiveToast(null)
          void onUndo()
        },
      },
    })
  }, [clearPending, toast])

  return { scheduleDelete, clearPending }
}
