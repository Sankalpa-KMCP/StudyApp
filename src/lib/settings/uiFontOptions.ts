export const UI_FONT_OPTIONS = ['Inter', 'Outfit', 'System'] as const

export type UiFontOption = (typeof UI_FONT_OPTIONS)[number]
