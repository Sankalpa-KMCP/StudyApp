export type ThemeColorScheme = 'light' | 'dark'

export const THEME_MODES = [
  'monochrome',
  'light',
  'blueprint',
  'moss',
  'ember',
  'sage',
  'rose-quartz',
  'ocean-glass',
  'sandstone',
  'crystal-glass',
  'wisteria',
  'dark',
  'aurora',
  'nordic',
  'espresso',
  'obsidian',
  'plum-noir',
  'forest-dark',
  'celestial',
  'velvet-dusk',
  'abyss',
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
    id: 'rose-quartz',
    label: 'Rose Quartz',
    description: 'Dusty rose paper, slate-plum ink, and deep wine accents.',
    colorScheme: 'light',
    themeColor: '#fbf0f2',
  },
  {
    id: 'ocean-glass',
    label: 'Ocean Glass',
    description: 'Airy sea-glass paper, marine ink, and coastal cyan accents.',
    colorScheme: 'light',
    themeColor: '#eaf2f2',
  },
  {
    id: 'sandstone',
    label: 'Sandstone',
    description: 'Warm desert sandstone, dry linen paper, and burnt ochre accents.',
    colorScheme: 'light',
    themeColor: '#f5eee4',
  },
  {
    id: 'crystal-glass',
    label: 'Crystal Glass',
    description: 'Frosted crystal surfaces over a soft pastel aurora.',
    colorScheme: 'light',
    themeColor: '#e8e9f8',
  },
  {
    id: 'wisteria',
    label: 'Wisteria Bloom',
    description: 'Ivory paper, lavender petals, and elegant plum ink.',
    colorScheme: 'light',
    themeColor: '#f4eff7',
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
  {
    id: 'plum-noir',
    label: 'Plum Noir',
    description: 'Deep velvet plum, radiant raspberry accents, and champagne highlights.',
    colorScheme: 'dark',
    themeColor: '#151018',
  },
  {
    id: 'forest-dark',
    label: 'Forest Dark',
    description: 'Inky pine black, deep spruce surfaces, and radiant emerald glow.',
    colorScheme: 'dark',
    themeColor: '#0e1814',
  },
  {
    id: 'celestial',
    label: 'Celestial Drift',
    description: 'Deep indigo starlight with a quiet lunar glow.',
    colorScheme: 'dark',
    themeColor: '#090d22',
  },
  {
    id: 'velvet-dusk',
    label: 'Velvet Dusk',
    description: 'Plum twilight, a coral horizon, and distant city glow.',
    colorScheme: 'dark',
    themeColor: '#180e20',
  },
  {
    id: 'abyss',
    label: 'Abyssal Glow',
    description: 'Ocean-black depth illuminated by bioluminescent cyan.',
    colorScheme: 'dark',
    themeColor: '#061518',
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
