import type { CategoryItem, DailyLog, FlashcardItem, HistoryEntry, QuickNoteItem, SettingsRow, TaskItem } from '../../../db/types'

export interface StudyBackupPayload {
  version: number
  exportedAt: string
  checksumSha256?: string
  tasks: TaskItem[]
  history: HistoryEntry[]
  dailyLogs: DailyLog[]
  settings: SettingsRow[]
  categories: CategoryItem[]
  flashcards: FlashcardItem[]
  quickNotes: QuickNoteItem[]
}

export interface StudyLogLike {
  dateString: string
  studyMinutes: number
}

export interface HistoryEntryLike {
  type: 'study' | 'break'
  durationMinutes: number
  categoryId?: number
  taskId?: number
  timestamp: string
  createdAt?: number
}

export interface TaskCompletionLike {
  completed: boolean
}

export interface StudyBackupInput {
  version?: unknown
  exportedAt?: unknown
  tasks?: unknown
  history?: unknown
  dailyLogs?: unknown
  settings?: unknown
  categories?: unknown
  flashcards?: unknown
  quickNotes?: unknown
  quick_notes?: unknown
  checksumSha256?: unknown
}

export interface ParsedStudyBackupPayload extends StudyBackupPayload {
  rawVersion: unknown
}
