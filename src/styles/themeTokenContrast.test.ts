import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  formatContrastFailure,
  parseCssHexColor,
  parseThemeTokens,
} from './themeTokenContrast'

const TOKENS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tokens.css')
const EXPECTED_THEMES = ['monochrome', 'light', 'dark', 'aurora', 'ember', 'blueprint', 'moss'] as const

const TEXT_BACKGROUNDS = ['bg', 'surface', 'surface-subtle'] as const
const TEXT_MIN = 4.5
const TEXT_MARGIN_MIN = 4.6
const CONTROL_MIN = 3
const CONTROL_MARGIN_MIN = 3.2

describe('themeTokenContrast helpers', () => {
  it('parses hex colors and computes known WCAG ratios without early rounding', () => {
    expect(parseCssHexColor('#000000')).toEqual([0, 0, 0])
    expect(parseCssHexColor('#ffffff')).toEqual([255, 255, 255])
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5)
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5)
    expect(() => parseCssHexColor('rgb(0,0,0)')).toThrow(/unparsable/i)
  })

  it('formats failure details with theme, tokens, ratio, and threshold', () => {
    expect(formatContrastFailure({
      theme: 'ember',
      foregroundToken: '--quiet',
      backgroundToken: '--bg',
      ratio: 4.1,
      required: 4.5,
    })).toContain('theme=ember')
  })
})

describe('theme token contrast contracts', () => {
  const css = readFileSync(TOKENS_PATH, 'utf8')
  const themes = parseThemeTokens(css)

  it('exposes all seven themes including Monochrome base :root tokens', () => {
    expect(Object.keys(themes).sort()).toEqual([...EXPECTED_THEMES].sort())
    for (const theme of EXPECTED_THEMES) {
      expect(themes[theme].bg).toMatch(/^#[0-9a-f]{6}$/i)
      expect(themes[theme].muted).toMatch(/^#[0-9a-f]{6}$/i)
      expect(themes[theme].quiet).toMatch(/^#[0-9a-f]{6}$/i)
      expect(themes[theme]['control-border']).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('keeps ordinary muted and quiet text above 4.5:1 with a 4.6:1 regression margin', () => {
    const failures: string[] = []

    for (const themeName of EXPECTED_THEMES) {
      const theme = themes[themeName]
      for (const textToken of ['muted', 'quiet'] as const) {
        for (const backgroundToken of TEXT_BACKGROUNDS) {
          const ratio = contrastRatio(theme[textToken], theme[backgroundToken])
          if (ratio < TEXT_MIN || ratio < TEXT_MARGIN_MIN) {
            failures.push(formatContrastFailure({
              theme: themeName,
              foregroundToken: `--${textToken}`,
              backgroundToken: `--${backgroundToken}`,
              ratio,
              required: ratio < TEXT_MIN ? TEXT_MIN : TEXT_MARGIN_MIN,
            }))
          }
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('keeps required control borders at least 3:1 with a 3.2:1 regression margin', () => {
    const failures: string[] = []

    for (const themeName of EXPECTED_THEMES) {
      const theme = themes[themeName]
      for (const backgroundToken of ['bg', 'surface'] as const) {
        const ratio = contrastRatio(theme['control-border'], theme[backgroundToken])
        if (ratio < CONTROL_MIN || ratio < CONTROL_MARGIN_MIN) {
          failures.push(formatContrastFailure({
            theme: themeName,
            foregroundToken: '--control-border',
            backgroundToken: `--${backgroundToken}`,
            ratio,
            required: ratio < CONTROL_MIN ? CONTROL_MIN : CONTROL_MARGIN_MIN,
          }))
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('fails clearly when a required theme block is missing', () => {
    expect(() => parseThemeTokens(':root {\n  --bg: #ffffff;\n}')).toThrow(/missing tokens/i)
  })
})
