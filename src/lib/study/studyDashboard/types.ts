import type { CategoryItem, DailyLog, HistoryEntry, QuickNoteItem, SettingsRow, TaskItem } from '../../../db/types'

export interface StudyBackupPayload {
  version: number
  exportedAt: string
  checksumSha256?: string
  tasks: TaskItem[]
  history: HistoryEntry[]
  dailyLogs: DailyLog[]
  settings: SettingsRow[]
  categories: CategoryItem[]
  quickNotes: QuickNoteItem[]
}

/** Legacy flashcard rows from v1–v3 backups (parse/checksum only; not persisted). */
export interface LegacyFlashcardRow {
  question: string
  answer: string
  [key: string]: unknown
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
  /** Set when importing legacy backups that included flashcards (checksum + user notice). */
  _legacyFlashcards?: LegacyFlashcardRow[]
}
