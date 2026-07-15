import { useState, useEffect, useCallback } from 'react'
import { t } from '../i18n'
import type { ToastAction, ToastState } from '../types/app'

export function useAppToast() {
  const [activeToast, setActiveToast] = useState<ToastState | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  const pushToast = useCallback((key: string, message: string, options?: { action?: ToastAction; durationMs?: number }) => {
    setActiveToast({ key, message, id: Date.now(), ...options })
  }, [])

  const dismissQuotaRecovery = useCallback(() => {
    setQuotaExceeded(false)
  }, [])

  useEffect(() => {
    if (!activeToast) return
    const duration = activeToast.durationMs ?? (activeToast.key === 'LEVEL UP' ? 4000 : activeToast.action ? 5000 : 1500)
    const timeoutId = setTimeout(() => setActiveToast(null), duration)
    return () => clearTimeout(timeoutId)
  }, [activeToast])

  useEffect(() => {
    function handleDexieError(e: Event) {
      const error = (e as CustomEvent).detail as { name?: string; message?: string }
      const name = error?.name || 'IndexedDBError'
      const message = error?.message || 'Database transaction failed'
      if (name === 'QuotaExceededError' || message.toLowerCase().includes('quota') || message.toLowerCase().includes('exhausted')) {
        setQuotaExceeded(true)
        pushToast('DATABASE', t('storageQuotaExceeded'))
      } else {
        pushToast('DATABASE', t('dbError', { name: name.toUpperCase() }))
      }
    }
    window.addEventListener('dexie-error', handleDexieError)
    return () => window.removeEventListener('dexie-error', handleDexieError)
  }, [pushToast])

  return { activeToast, setActiveToast, pushToast, quotaExceeded, dismissQuotaRecovery }
}
