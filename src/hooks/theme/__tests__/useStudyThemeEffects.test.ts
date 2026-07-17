import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStudyThemeEffects } from '../useStudyThemeEffects'
import type { ParsedSettings } from '../../../db/selectors/settingsFromRows'

const applyThemeToDocument = vi.fn()
const loadAppFonts = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../lib/theme/applyThemeVars', () => ({
  applyThemeToDocument: (...args: unknown[]) => applyThemeToDocument(...args),
}))

vi.mock('../../../lib/theme/loadAppFonts', () => ({
  loadAppFonts: (...args: unknown[]) => loadAppFonts(...args),
}))

const baseSettings = {
  theme: 'dark',
  themePreset: 'midnight',
  lightThemePreset: 'daylight',
  accentBlueOverride: null,
  accentPurpleOverride: null,
  accentGreenOverride: null,
  accentAmberOverride: null,
  cardOpacity: 0.85,
  backdropBlur: 12,
  backdropSaturate: 1.2,
  cardBorderOpacity: 0.12,
  ui_font: 'Inter',
  developer_font: 'JetBrains Mono',
} as Pick<
  ParsedSettings,
  | 'theme'
  | 'themePreset'
  | 'lightThemePreset'
  | 'accentBlueOverride'
  | 'accentPurpleOverride'
  | 'accentGreenOverride'
  | 'accentAmberOverride'
  | 'cardOpacity'
  | 'backdropBlur'
  | 'backdropSaturate'
  | 'cardBorderOpacity'
  | 'ui_font'
  | 'developer_font'
>

describe('useStudyThemeEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies theme vars and font stacks to the document', () => {
    const { result } = renderHook(() => useStudyThemeEffects(baseSettings))

    expect(result.current.accentBlue).toBeTruthy()
    expect(applyThemeToDocument).toHaveBeenCalled()
    expect(loadAppFonts).toHaveBeenCalledWith('Inter', 'JetBrains Mono')
    expect(document.documentElement.style.getPropertyValue('--font-sans-geom')).toContain('Inter')
    expect(document.documentElement.style.getPropertyValue('--font-monospace')).toContain('JetBrains Mono')
  })
})
