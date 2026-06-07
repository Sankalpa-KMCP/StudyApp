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
  pageGradient: string
  accentBlue: string
  accentPurple: string
  accentGreen: string
  accentAmber: string
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

export interface ToastState {
  key: string
  message: string
  id: number
}
