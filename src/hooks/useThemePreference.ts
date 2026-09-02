import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ThemeMode,
  isThemeMode,
} from '../styles/themeRegistry'

export type { ThemeColorScheme, ThemeConfig, ThemeMode } from '../styles/themeRegistry'
export {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_CONFIGS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  getThemeConfig,
  isThemeMode,
} from '../styles/themeRegistry'

export function readStoredThemeMode(): ThemeMode {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(savedTheme) ? savedTheme : DEFAULT_THEME_MODE
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export type UseThemePreferenceOptions = {
  /** Cleared on user-initiated theme changes; set only when a user change fails to persist. */
  onPreferenceError: (message: string) => void
  clearPreferenceNotice: () => void
}

export type UseThemePreferenceResult = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

/**
 * Theme preference: guarded localStorage init/persist, document theme attribute,
 * and theme-color meta updates. Persistence failures are reported via App's shared notice.
 */
export function useThemePreference({
  onPreferenceError,
  clearPreferenceNotice,
}: UseThemePreferenceOptions): UseThemePreferenceResult {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredThemeMode())
  const themeUserChangeRef = useRef(false)
  const onPreferenceErrorRef = useRef(onPreferenceError)
  const clearPreferenceNoticeRef = useRef(clearPreferenceNotice)

  useEffect(() => {
    onPreferenceErrorRef.current = onPreferenceError
    clearPreferenceNoticeRef.current = clearPreferenceNotice
  }, [onPreferenceError, clearPreferenceNotice])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      if (themeUserChangeRef.current) {
        onPreferenceErrorRef.current('Theme preference could not be saved.')
      }
    } finally {
      themeUserChangeRef.current = false
    }
  }, [theme])

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    themeUserChangeRef.current = true
    clearPreferenceNoticeRef.current()
    setThemeState(nextTheme)
  }, [])

  return { theme, setTheme }
}
