import { useCallback, useEffect, useRef, useState } from 'react'

export const SIDEBAR_STORAGE_KEY = 'study-dashboard-sidebar'

export function readStoredSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed'
}

export type UseSidebarPreferenceOptions = {
  /** Cleared on user-initiated toggles; set only when a user change fails to persist. */
  onPreferenceError: (message: string) => void
  clearPreferenceNotice: () => void
}

export type UseSidebarPreferenceResult = {
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void
}

/**
 * Sidebar collapse preference: guarded localStorage init/persist for the desktop shell.
 * Persistence failures are reported via App's shared notice.
 */
export function useSidebarPreference({
  onPreferenceError,
  clearPreferenceNotice,
}: UseSidebarPreferenceOptions): UseSidebarPreferenceResult {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredSidebarCollapsed())
  const sidebarUserChangeRef = useRef(false)
  const onPreferenceErrorRef = useRef(onPreferenceError)
  const clearPreferenceNoticeRef = useRef(clearPreferenceNotice)

  useEffect(() => {
    onPreferenceErrorRef.current = onPreferenceError
    clearPreferenceNoticeRef.current = clearPreferenceNotice
  }, [onPreferenceError, clearPreferenceNotice])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? 'collapsed' : 'expanded')
    } catch {
      if (sidebarUserChangeRef.current) {
        onPreferenceErrorRef.current('Sidebar preference could not be saved.')
      }
    } finally {
      sidebarUserChangeRef.current = false
    }
  }, [sidebarCollapsed])

  const toggleSidebarCollapsed = useCallback(() => {
    sidebarUserChangeRef.current = true
    clearPreferenceNoticeRef.current()
    setSidebarCollapsed((collapsed) => !collapsed)
  }, [])

  return { sidebarCollapsed, toggleSidebarCollapsed }
}
