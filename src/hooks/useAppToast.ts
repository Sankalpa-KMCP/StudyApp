import { useState, useEffect, useCallback } from 'react'
import type { ToastState } from '../types/app'

export function useAppToast() {
  const [activeToast, setActiveToast] = useState<ToastState | null>(null)

  const pushToast = useCallback((key: string, message: string) => {
    setActiveToast({ key, message, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!activeToast) return
    const duration = activeToast.key === 'LEVEL UP' ? 4000 : 1500
    const t = setTimeout(() => setActiveToast(null), duration)
    return () => clearTimeout(t)
  }, [activeToast])

  useEffect(() => {
    function handleDexieError(e: Event) {
      const error = (e as CustomEvent).detail as { name?: string; message?: string }
      const name = error?.name || 'IndexedDBError'
      const message = error?.message || 'Database transaction failed'
      if (name === 'QuotaExceededError' || message.toLowerCase().includes('quota') || message.toLowerCase().includes('exhausted')) {
        pushToast('DATABASE', 'Storage quota exceeded — export a backup in Settings')
      } else {
        pushToast('DATABASE', `DB ERROR: ${name.toUpperCase()}`)
      }
    }
    window.addEventListener('dexie-error', handleDexieError)
    return () => window.removeEventListener('dexie-error', handleDexieError)
  }, [pushToast])

  return { activeToast, setActiveToast, pushToast }
}
