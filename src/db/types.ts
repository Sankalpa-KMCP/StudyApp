export type TaskStatus = 'open' | 'done'

export type TaskPriority = 'low' | 'normal' | 'high'

export type GoalPeriod = 'daily' | 'weekly' | 'monthly'

/** How goal progress is measured. `study_time` uses session totals; `manual` uses stored `progress`. */
export type GoalMetric = 'manual' | 'study_time'

export function isGoalMetric(value: unknown): value is GoalMetric {
  return value === 'manual' || value === 'study_time'
}

/** How subject progress is measured. `study_time` uses session totals; `manual` uses stored `progress`. */
export type SubjectProgressMode = 'manual' | 'study_time'

export function isSubjectProgressMode(value: unknown): value is SubjectProgressMode {
  return value === 'manual' || value === 'study_time'
}

export type StudyTask = {
  id: string
  title: string
  subjectId: string
  dueDate: string
  priority: TaskPriority
  status: TaskStatus
  minutes: number
  createdAt: string
  updatedAt: string
}

export type StudySubject = {
  id: string
  name: string
  color: string
  targetHours: number
  /** Manual percentage 0–100; retained in every mode so switching modes never discards it. */
  progress: number
  progressMode: SubjectProgressMode
  createdAt: string
  updatedAt: string
}

/** Pre-mode subject shape found in version-1 and version-2 backups (no `progressMode` field). */
export type StudySubjectLegacy = Omit<StudySubject, 'progressMode'>

export type StudyNote = {
  id: string
  title: string
  body: string
  subjectId: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type CalendarEvent = {
  id: string
  title: string
  subjectId: string
  startAt: string
  endAt: string
  location: string
  createdAt: string
  updatedAt: string
}

export type StudySession = {
  id: string
  subjectId: string
  startedAt: string
  endedAt: string
  minutes: number
  note: string
}

export type StudyGoal = {
  id: string
  title: string
  target: number
  progress: number
  period: GoalPeriod
  metric: GoalMetric
  createdAt: string
  updatedAt: string
}

export type StudySetting = {
  key: string
  value: unknown
}

/** Unfinished focus session persisted under settings key `activeFocusSession`. */
export type ActiveFocusSessionStatus = 'running' | 'paused'

export type ActiveFocusSession = {
  id: string
  subjectId: string
  /** Canonical start instant (ISO-8601). Elapsed time is derived from this. */
  startedAt: string
  /** Planned length in minutes; `0` means open-ended. */
  plannedMinutes: number
  status: ActiveFocusSessionStatus
  /** Set when `status === 'paused'`; otherwise `null`. */
  pausedAt: string | null
  accumulatedPausedMs: number
}

/** Pre-metric goal shape found in version-1 backups (no `metric` field). */
export type StudyGoalV1 = Omit<StudyGoal, 'metric'>

export const EXPORT_SCHEMA_VERSION = 4
export type ExportSchemaVersion = typeof EXPORT_SCHEMA_VERSION

type StudyExportTablesLegacy = {
  tasks: StudyTask[]
  subjects: StudySubjectLegacy[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards?: unknown[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

type StudyExportTablesV3 = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards?: unknown[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

type StudyExportTables = {
  tasks: StudyTask[]
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  studySessions: StudySession[]
  settings: StudySetting[]
}

/** Legacy backup format (goals without required metrics; subjects without progress modes; legacy flashcards). */
export type StudyExportV1 = StudyExportTablesLegacy & {
  version: 1
  exportedAt: string
  appVersion?: string
  goals: StudyGoalV1[]
}

/** Legacy backup format (with goal metrics; subjects without progress modes; legacy flashcards). */
export type StudyExportV2 = StudyExportTablesLegacy & {
  version: 2
  exportedAt: string
  appVersion?: string
  goals: StudyGoal[]
}

/** Legacy backup format (goals require metrics; subjects require progress modes; legacy flashcards). */
export type StudyExportV3 = StudyExportTablesV3 & {
  version: 3
  exportedAt: string
  appVersion?: string
  goals: StudyGoal[]
}

/** Current backup format (version 4: no flashcards). */
export type StudyExportV4 = StudyExportTables & {
  version: 4
  exportedAt: string
  appVersion?: string
  goals: StudyGoal[]
}

/** Current export/import product shape after normalization. */
export type StudyExport = StudyExportV4

export type StudyData = Omit<StudyExport, 'version' | 'exportedAt' | 'appVersion'>
