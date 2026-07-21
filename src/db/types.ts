export type TaskStatus = 'open' | 'done'

export type TaskPriority = 'low' | 'normal' | 'high'

export type FlashcardStatus = 'new' | 'learning' | 'remembered'

export type GoalPeriod = 'daily' | 'weekly' | 'monthly'

/** How goal progress is measured. `study_time` uses session totals; `manual` uses stored `progress`. */
export type GoalMetric = 'manual' | 'study_time'

export function isGoalMetric(value: unknown): value is GoalMetric {
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
  progress: number
  createdAt: string
  updatedAt: string
}

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

export type Flashcard = {
  id: string
  front: string
  back: string
  subjectId: string
  status: FlashcardStatus
  lastReviewedAt: string
  dueAt?: string
  intervalDays?: number
  reviewCount?: number
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

export type StudyExport = {
  version: 1
  exportedAt: string
  tasks: StudyTask[]
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  flashcards: Flashcard[]
  studySessions: StudySession[]
  goals: StudyGoal[]
  settings: StudySetting[]
}

export type StudyData = Omit<StudyExport, 'version' | 'exportedAt'>
