export interface CategoryItem {
  id?: number
  name: string
  color: string
}

export interface TaskItem {
  id?: number
  text: string
  completed: boolean
  createdAt: number
  categoryId?: number
  estimatedCycles: number
  actualCycles: number
  repetitionCount?: number
  easinessFactor?: number
  intervalDays?: number
  nextReviewDate?: string
}

export interface HistoryEntry {
  id?: number
  timestamp: string
  type: 'study' | 'break'
  durationMinutes: number
  categoryId?: number
}

export interface DailyLog {
  dateString: string
  studyMinutes: number
  breakMinutes: number
  notes?: string
  mood?: string
}

export type SettingsKey = 'dailyGoalMinutes' | 'soundEnabled' | 'targetSessionsPerCycle' | 'longBreakDurationMinutes' | 'ambientTrack' | 'ambientVolume' | 'ambientVolume_rain' | 'ambientVolume_cafe' | 'ambientVolume_whiteNoise' | 'theme' | 'cardOpacity' | 'backdropBlur' | 'audio_presets' | 'shortBreakDurationMinutes' | 'ambient_alphaWaves' | 'tactile_feedback' | 'developer_font' | 'enforce_lockout'

export interface SettingsRow {
  key: SettingsKey
  value: any
}

