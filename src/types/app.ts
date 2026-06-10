export interface PendingSessionData {
  elapsed: number
  mode: 'study' | 'break'
  timestamp: string
  categoryId?: number
}

export interface ThemeProfile {
  surface: string
  surfaceCard: string
  surfaceCardRgb: string
  surfaceCardHover?: string
  surfaceCardHoverRgb?: string
  pageGradient: string
  ambientGlow?: string
  accentBlue: string
  accentPurple: string
  accentGreen: string
  accentAmber: string
  isLight?: boolean
  textPrimary?: string
  textSecondary?: string
  textMuted?: string
  onAccent?: string
  navActiveText?: string
  scrollbarThumb?: string
  scrollbarThumbHover?: string
}

export interface ThemePresetMeta {
  id: string
  label: string
  description: string
  isLight: boolean
  swatchOrder: number
}

export interface DayData {
  date: number
  dayName: string
  studyTime: string
  breakTime: string
  focusRatio: string
  sessionsCompleted: string
  focusScore: string
  intensity: 0 | 1 | 2 | 3
}

export type ActiveTab = 'focus' | 'analytics' | 'journal' | 'cards' | 'settings'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastState {
  key: string
  message: string
  id: number
  action?: ToastAction
  durationMs?: number
}
