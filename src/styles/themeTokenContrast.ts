/** WCAG 2 relative-luminance / contrast-ratio helpers for theme-token regression. */

export type Rgb = readonly [number, number, number]

export function parseCssHexColor(value: string): Rgb {
  const trimmed = value.trim()
  const match = /^#([0-9a-f]{6})$/i.exec(trimmed)
  if (!match) {
    throw new Error(`Unsupported or unparsable CSS color: ${value}`)
  }
  const hex = match[1]
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/** WCAG contrast ratio; do not round before comparing to thresholds. */
export function contrastRatio(foreground: string, background: string): number {
  const L1 = relativeLuminance(parseCssHexColor(foreground))
  const L2 = relativeLuminance(parseCssHexColor(background))
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

export type ThemeTokenSet = {
  bg: string
  surface: string
  'surface-subtle': string
  muted: string
  quiet: string
  'control-border': string
}

const REQUIRED_TOKENS = ['bg', 'surface', 'surface-subtle', 'muted', 'quiet', 'control-border'] as const

function extractDeclarations(block: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    declarations[match[1]] = match[2].trim()
  }
  return declarations
}

function requireTokens(theme: string, declarations: Record<string, string>): ThemeTokenSet {
  const missing = REQUIRED_TOKENS.filter((token) => !declarations[token])
  if (missing.length > 0) {
    throw new Error(`Theme "${theme}" is missing tokens: ${missing.join(', ')}`)
  }
  return {
    bg: declarations.bg,
    surface: declarations.surface,
    'surface-subtle': declarations['surface-subtle'],
    muted: declarations.muted,
    quiet: declarations.quiet,
    'control-border': declarations['control-border'],
  }
}

/**
 * Parse `tokens.css` theme blocks. Monochrome is the bare `:root` block
 * (before any `[data-theme]` override).
 */
export function parseThemeTokens(css: string): Record<string, ThemeTokenSet> {
  const monochromeMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/)
  if (!monochromeMatch) {
    throw new Error('Could not parse Monochrome :root token block')
  }

  const themes: Record<string, ThemeTokenSet> = {
    monochrome: requireTokens('monochrome', extractDeclarations(monochromeMatch[1])),
  }

  for (const match of css.matchAll(/:root\[data-theme='([a-z]+)'\]\s*\{([\s\S]*?)\n\}/g)) {
    const theme = match[1]
    themes[theme] = requireTokens(theme, extractDeclarations(match[2]))
  }

  return themes
}

export function formatContrastFailure(details: {
  theme: string
  foregroundToken: string
  backgroundToken: string
  ratio: number
  required: number
}): string {
  return [
    `theme=${details.theme}`,
    `fg=${details.foregroundToken}`,
    `bg=${details.backgroundToken}`,
    `ratio=${details.ratio}`,
    `required=${details.required}`,
  ].join(' ')
}
