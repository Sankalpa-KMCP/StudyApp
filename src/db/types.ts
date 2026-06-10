export interface CategoryItem {
  id?: number
  name: string
  color: string
  dailyGoalMinutes?: number
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
  createdAt: number
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

export type SettingsKey =
  | 'dailyGoalMinutes'
  | 'soundEnabled'
  | 'targetSessionsPerCycle'
  | 'longBreakDurationMinutes'
  | 'shortBreakDurationMinutes'
  | 'studyBlockDurationMinutes'
  | 'theme'
  | 'themePreset'
  | 'lightThemePreset'
  | 'ui_font'
  | 'uiDensity'
  | 'backdropSaturate'
  | 'cardBorderOpacity'
  | 'accentBlueOverride'
  | 'accentPurpleOverride'
  | 'accentGreenOverride'
  | 'accentAmberOverride'
  | 'noteTagColors'
  | 'recentHistoryLimit'
  | 'focusNotificationsEnabled'
  | 'cardOpacity'
  | 'backdropBlur'
  | 'tactile_feedback'
  | 'developer_font'
  | 'enforce_lockout'
  | 'initialEasinessFactor'
  | 'autoArchiveAncientTasks'
  | 'auto_pause_on_hidden'

export type SettingsValue = number | boolean | string | null

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

export interface SnapshotRow {
  id?: number
  timestamp: string
  payload: string
}
