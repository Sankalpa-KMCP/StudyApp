import { useCallback, useEffect, useRef, useState } from 'react'

export type ThemeMode = 'monochrome' | 'light' | 'dark' | 'aurora' | 'ember' | 'blueprint' | 'moss'

export const THEME_STORAGE_KEY = 'study-dashboard-theme'

export const THEME_COLORS: Record<ThemeMode, string> = {
  monochrome: '#111111',
  light: '#f4f0e8',
  dark: '#10141d',
  aurora: '#111323',
  ember: '#f3e4d2',
  blueprint: '#153f73',
  moss: '#294633',
}

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'monochrome'
    || value === 'light'
    || value === 'dark'
    || value === 'aurora'
    || value === 'ember'
    || value === 'blueprint'
    || value === 'moss'
}

export function readStoredThemeMode(): ThemeMode {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(savedTheme) ? savedTheme : 'monochrome'
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
