import { useCallback, useEffect, useState } from 'react'

export const SETTINGS_SHOW_ADVANCED_KEY = 'settings_show_advanced'
export const SETTINGS_ADVANCED_CHANGED_EVENT = 'settings-advanced-changed'

function readAdvancedMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SETTINGS_SHOW_ADVANCED_KEY) === 'true'
}

export function enableAdvancedSettings(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SETTINGS_SHOW_ADVANCED_KEY) === 'true') return
  localStorage.setItem(SETTINGS_SHOW_ADVANCED_KEY, 'true')
  window.dispatchEvent(new CustomEvent(SETTINGS_ADVANCED_CHANGED_EVENT, { detail: true }))
}

export function useSettingsAdvancedMode() {
  const [showAdvanced, setShowAdvancedState] = useState(readAdvancedMode)

  useEffect(() => {
    const handler = () => setShowAdvancedState(readAdvancedMode())
    window.addEventListener(SETTINGS_ADVANCED_CHANGED_EVENT, handler)
    return () => window.removeEventListener(SETTINGS_ADVANCED_CHANGED_EVENT, handler)
  }, [])

  const setShowAdvanced = useCallback((next: boolean) => {
    localStorage.setItem(SETTINGS_SHOW_ADVANCED_KEY, String(next))
    setShowAdvancedState(next)
    window.dispatchEvent(new CustomEvent(SETTINGS_ADVANCED_CHANGED_EVENT, { detail: next }))
  }, [])

  return { showAdvanced, setShowAdvanced }
}
