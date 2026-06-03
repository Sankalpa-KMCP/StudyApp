export interface CategoryItem {
  id?: number
  name: string
  color: string
}

export interface SubTask {
  id: string
  text: string
  completed: boolean
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
  isStudySubject?: boolean
  subtasks?: SubTask[]
  archived?: boolean
}

export interface HistoryEntry {
  id?: number
  timestamp: string
  type: 'study' | 'break'
  durationMinutes: number
  categoryId?: number
  sessionNotes?: string
  attentionRating?: number
  stabilityRating?: number
}

export interface DailyLog {
  dateString: string
  studyMinutes: number
  breakMinutes: number
  notes?: string
  mood?: string
}

export interface AudioPreset {
  name: string
  rain: number
  cafe: number
  whiteNoise: number
  alphaWaves: number
}

export type SettingsKey = 'dailyGoalMinutes' | 'soundEnabled' | 'targetSessionsPerCycle' | 'longBreakDurationMinutes' | 'ambientTrack' | 'ambientVolume' | 'ambientVolume_rain' | 'ambientVolume_cafe' | 'ambientVolume_whiteNoise' | 'theme' | 'cardOpacity' | 'backdropBlur' | 'audio_presets' | 'shortBreakDurationMinutes' | 'ambient_alphaWaves' | 'tactile_feedback' | 'developer_font' | 'enforce_lockout' | 'noiseType' | 'binauralTarget' | 'initialEasinessFactor' | 'autoArchiveAncientTasks'

export type SettingsValue = number | boolean | string | AudioPreset[] | null

export interface SettingsRow {
  key: SettingsKey
  value: SettingsValue
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



