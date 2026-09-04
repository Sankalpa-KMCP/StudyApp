import { useCallback, useEffect, useRef, useState } from 'react'

export type DensityMode = 'comfortable' | 'compact'
export const DENSITY_STORAGE_KEY = 'study-dashboard-density'
export const DEFAULT_DENSITY_MODE: DensityMode = 'comfortable'

export function isDensityMode(value: unknown): value is DensityMode {
  return value === 'comfortable' || value === 'compact'
}

export function readStoredDensity(): DensityMode {
  try {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY)
    return isDensityMode(saved) ? saved : DEFAULT_DENSITY_MODE
  } catch {
    return DEFAULT_DENSITY_MODE
  }
}

export type UseDensityPreferenceOptions = {
  /** Cleared on user-initiated density changes; set only when a user change fails to persist. */
  onPreferenceError: (message: string) => void
  clearPreferenceNotice: () => void
}

export type UseDensityPreferenceResult = {
  density: DensityMode
  setDensity: (density: DensityMode) => void
}

/**
 * Density preference: guarded localStorage init/persist for Home presentation density.
 * Persistence failures are reported via App's shared notice.
 */
export function useDensityPreference({
  onPreferenceError,
  clearPreferenceNotice,
}: UseDensityPreferenceOptions): UseDensityPreferenceResult {
  const [density, setDensityState] = useState<DensityMode>(() => readStoredDensity())
  const densityUserChangeRef = useRef(false)
  const onPreferenceErrorRef = useRef(onPreferenceError)
  const clearPreferenceNoticeRef = useRef(clearPreferenceNotice)

  useEffect(() => {
    onPreferenceErrorRef.current = onPreferenceError
    clearPreferenceNoticeRef.current = clearPreferenceNotice
  }, [onPreferenceError, clearPreferenceNotice])

  useEffect(() => {
    document.documentElement.dataset.density = density
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density)
    } catch {
      if (densityUserChangeRef.current) {
        onPreferenceErrorRef.current('Density preference could not be saved.')
      }
    } finally {
      densityUserChangeRef.current = false
    }
  }, [density])

  const setDensity = useCallback((nextDensity: DensityMode) => {
    densityUserChangeRef.current = true
    clearPreferenceNoticeRef.current()
    setDensityState(nextDensity)
  }, [])

  return { density, setDensity }
}
