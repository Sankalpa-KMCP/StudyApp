import { useCallback, useEffect, useState } from 'react'
import {
  SETTINGS_ADVANCED_CHANGED_EVENT,
  SETTINGS_SHOW_ADVANCED_KEY,
  readAdvancedSettingsMode,
} from '../lib/settings/settingsAdvancedMode'

export function useSettingsAdvancedMode() {
  const [showAdvanced, setShowAdvancedState] = useState(readAdvancedSettingsMode)

  useEffect(() => {
    const handler = () => setShowAdvancedState(readAdvancedSettingsMode())
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
