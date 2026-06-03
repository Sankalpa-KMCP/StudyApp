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
  priority?: 'low' | 'medium' | 'high'
  latestGrade?: number
}

export interface HistoryEntry {
  id?: number
  timestamp: string
  type: 'study' | 'break'
  durationMinutes: number
  categoryId?: number
  sessionNotes?: string
}

export interface DailyLog {
  dateString: string
  studyMinutes: number
  breakMinutes: number
  notes?: string
  mood?: string
}

export type SettingsKey = 'dailyGoalMinutes' | 'soundEnabled' | 'targetSessionsPerCycle' | 'longBreakDurationMinutes' | 'ambientTrack' | 'ambientVolume' | 'ambientVolume_rain' | 'ambientVolume_cafe' | 'ambientVolume_whiteNoise' | 'theme' | 'cardOpacity' | 'backdropBlur' | 'audio_presets' | 'shortBreakDurationMinutes' | 'ambient_alphaWaves' | 'tactile_feedback' | 'developer_font' | 'enforce_lockout' | 'noiseType' | 'binauralTarget'

export interface SettingsRow {
  key: SettingsKey
  value: any
}

export interface FlashcardItem {
  id?: number
  question: string
  answer: string
  categoryId?: number
  createdAt: number
  repetitionCount: number
  easinessFactor: number
  intervalDays: number
  nextReviewDate?: string
  latestGrade?: number
}

export interface QuickNoteItem {
  id?: number
  title: string
  content: string
  categoryId?: number
  color?: string
  updatedAt: number
}



