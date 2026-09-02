export type ThemeColorScheme = 'light' | 'dark'

export const THEME_MODES = [
  'monochrome',
  'light',
  'blueprint',
  'moss',
  'ember',
  'sage',
  'dark',
  'aurora',
  'nordic',
  'espresso',
  'obsidian',
] as const

export type ThemeMode = (typeof THEME_MODES)[number]

export const DEFAULT_THEME_MODE: ThemeMode = 'monochrome'
export const THEME_STORAGE_KEY = 'study-dashboard-theme'

export type ThemeConfig = {
  id: ThemeMode
  label: string
  description: string
  colorScheme: ThemeColorScheme
  themeColor: string
}

export const THEME_CONFIGS: readonly ThemeConfig[] = [
  {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Crisp black ink on quiet neutral paper.',
    colorScheme: 'light',
    themeColor: '#111111',
  },
  {
    id: 'light',
    label: 'Canvas',
    description: 'Warm paper, forest ink, vermilion details.',
    colorScheme: 'light',
    themeColor: '#f4f0e8',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    description: 'Cool drafting paper with precise navy lines.',
    colorScheme: 'light',
    themeColor: '#153f73',
  },
  {
    id: 'moss',
    label: 'Moss Library',
    description: 'Olive green, aged paper, and muted brass.',
    colorScheme: 'light',
    themeColor: '#294633',
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Terracotta, parchment, and library blue.',
    colorScheme: 'light',
    themeColor: '#f3e4d2',
  },
  {
    id: 'sage',
    label: 'Sage Botanical',
    description: 'Muted eucalyptus paper, spruce green, and berry accents.',
    colorScheme: 'light',
    themeColor: '#eaf0eb',
  },
  {
    id: 'dark',
    label: 'Midnight',
    description: 'Inky blue with a soft amber reading light.',
    colorScheme: 'dark',
    themeColor: '#10141d',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Deep violet, orchid, and electric mint.',
    colorScheme: 'dark',
    themeColor: '#111323',
  },
  {
    id: 'nordic',
    label: 'Nordic Slate',
    description: 'Cool slate, arctic blue accents, and frost text.',
    colorScheme: 'dark',
    themeColor: '#12161f',
  },
  {
    id: 'espresso',
    label: 'Espresso',
    description: 'Roasted coffee, warm walnut wood, and golden honey accents.',
    colorScheme: 'dark',
    themeColor: '#181412',
  },
  {
    id: 'obsidian',
    label: 'High-Contrast Obsidian',
    description: 'Pitch black, vivid amber accents, and ultra-high contrast text.',
    colorScheme: 'dark',
    themeColor: '#0c0d11',
  },
] as const

export const THEME_COLORS: Record<ThemeMode, string> = Object.freeze(
  THEME_CONFIGS.reduce<Record<ThemeMode, string>>((acc, config) => {
    acc[config.id] = config.themeColor
    return acc
  }, {} as Record<ThemeMode, string>),
)

const THEME_SET = new Set<string>(THEME_MODES)

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_SET.has(value)
}

export function getThemeConfig(theme: ThemeMode): ThemeConfig {
  const config = THEME_CONFIGS.find((c) => c.id === theme)
  if (!config) {
    return THEME_CONFIGS[0]
  }
  return config
}
