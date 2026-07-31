import Dexie, { type Table } from 'dexie'
import { inferLegacyGoalMetric } from './goalMetricInference'
import type {
  CalendarEvent,
  Flashcard,
  GoalPeriod,
  StudyData,
  StudyExport,
  StudyGoal,
  StudyGoalV1,
  StudyNote,
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'
import { isGoalMetric } from './types'

const STUDY_DB_NAME = 'study-dashboard-db'
const LEGACY_STORAGE_KEY = 'study-dashboard-v2'
const LEGACY_MIGRATION_KEY = 'legacy-localstorage-migrated-v1'
const DEFAULT_SUBJECT_COLORS = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c']

const STUDY_DB_STORES = {
  tasks: '&id, status, priority, dueDate, subjectId, createdAt, updatedAt',
  subjects: '&id, name, color, createdAt, updatedAt',
  notes: '&id, subjectId, createdAt, updatedAt, *tags',
  events: '&id, subjectId, startAt, endAt, createdAt, updatedAt',
  flashcards: '&id, subjectId, status, lastReviewedAt, createdAt, updatedAt',
  studySessions: '&id, subjectId, startedAt, endedAt',
  goals: '&id, period, createdAt, updatedAt',
  settings: '&key',
} as const

function isGoalPeriod(value: unknown): value is GoalPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

export class StudyDatabase extends Dexie {
  tasks!: Table<StudyTask, string>
  subjects!: Table<StudySubject, string>
  notes!: Table<StudyNote, string>
  events!: Table<CalendarEvent, string>
  flashcards!: Table<Flashcard, string>
  studySessions!: Table<StudySession, string>
  goals!: Table<StudyGoal, string>
  settings!: Table<StudySetting, string>

  constructor() {
    super(STUDY_DB_NAME)
    this.version(1).stores(STUDY_DB_STORES)
    this.version(2).stores(STUDY_DB_STORES).upgrade(async (transaction) => {
      const goals = transaction.table('goals')
      await goals.toCollection().modify((goal: Record<string, unknown>) => {
        if (isGoalMetric(goal.metric)) return
        const period = isGoalPeriod(goal.period) ? goal.period : 'daily'
        const title = typeof goal.title === 'string' ? goal.title : ''
        goal.metric = inferLegacyGoalMetric(period, title)
      })
    })
  }
}

export const studyDb = new StudyDatabase()

const studyTables = [
  studyDb.tasks,
  studyDb.subjects,
  studyDb.notes,
  studyDb.events,
  studyDb.flashcards,
  studyDb.studySessions,
  studyDb.goals,
  studyDb.settings,
] as const

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export async function getStudyData(): Promise<StudyData> {
  const [tasks, subjects, notes, events, flashcards, studySessions, goals, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.notes.orderBy('updatedAt').reverse().toArray(),
    studyDb.events.orderBy('startAt').toArray(),
    studyDb.flashcards.orderBy('createdAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.goals.orderBy('createdAt').toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, notes, events, flashcards, studySessions, goals, settings }
}

export async function exportStudyData(): Promise<StudyExport> {
  return {
    version: 2,
    exportedAt: nowIso(),
    ...(await getStudyData()),
  }
}

export async function importStudyData(payload: unknown) {
  const normalized = parseAndNormalizeStudyExport(payload)

  await studyDb.transaction('rw', studyTables, async () => {
    await Promise.all(studyTables.map((table) => table.clear()))
    await Promise.all([
      studyDb.tasks.bulkPut(normalized.tasks),
      studyDb.subjects.bulkPut(normalized.subjects),
      studyDb.notes.bulkPut(normalized.notes),
      studyDb.events.bulkPut(normalized.events),
      studyDb.flashcards.bulkPut(normalized.flashcards),
      studyDb.studySessions.bulkPut(normalized.studySessions),
      studyDb.goals.bulkPut(normalized.goals),
      studyDb.settings.bulkPut(normalized.settings),
    ])
  })
}

export async function clearAllStudyData() {
  await studyDb.transaction('rw', studyTables, async () => {
    await Promise.all([
      studyDb.tasks.clear(),
      studyDb.subjects.clear(),
      studyDb.notes.clear(),
      studyDb.events.clear(),
      studyDb.flashcards.clear(),
      studyDb.studySessions.clear(),
      studyDb.goals.clear(),
    ])

    // Clean up study-related settings but preserve preference and migration keys
    // (`dailyGoalMinutes`, `legacy-localstorage-migrated-v1`). Theme lives in localStorage.
    // Key must match ACTIVE_FOCUS_SESSION_KEY in activeFocusSession.ts.
    await Promise.all([
      studyDb.settings.delete('quickNotes'),
      studyDb.settings.delete('activeFocusSession'),
    ])
  })
}

export async function migrateLegacyLocalStorage() {
  if (typeof window === 'undefined') return

  const migration = await studyDb.settings.get(LEGACY_MIGRATION_KEY)
  if (migration?.value === true) return

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  await studyDb.settings.put({ key: LEGACY_MIGRATION_KEY, value: true })
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as LegacyData
    if (!parsed || isLegacyDemoData(parsed)) return
    const migrated = migrateLegacyData(parsed)
    if (migrated.tasks.length + migrated.subjects.length + migrated.notes.length + migrated.events.length === 0) return

    await studyDb.transaction('rw', studyTables, async () => {
      await Promise.all([
        studyDb.subjects.bulkPut(migrated.subjects),
        studyDb.tasks.bulkPut(migrated.tasks),
        studyDb.notes.bulkPut(migrated.notes),
        studyDb.events.bulkPut(migrated.events),
        studyDb.settings.bulkPut(migrated.settings),
      ])
    })
  } catch {
    return
  }
}

/**
 * Validates a version-1 or version-2 backup and normalizes it to the current export shape.
 * Throws before any database mutation when the payload is unsupported or invalid.
 */
function parseAndNormalizeStudyExport(value: unknown): StudyExport {
  if (!isRecord(value)) {
    throw new Error('Import file is not a Study Dashboard export.')
  }

  const version = value.version
  if (version !== 1 && version !== 2) {
    throw new Error('Import file is not a Study Dashboard export.')
  }

  if (
    !isDate(value.exportedAt)
    || !isArrayOf(value.tasks, isStudyTask)
    || !isArrayOf(value.subjects, isStudySubject)
    || !isArrayOf(value.notes, isStudyNote)
    || !isArrayOf(value.events, isCalendarEvent)
    || !isArrayOf(value.flashcards, isFlashcard)
    || !isArrayOf(value.studySessions, isStudySession)
    || !isArrayOf(value.settings, isStudySetting)
  ) {
    throw new Error('Import file is not a Study Dashboard export.')
  }

  const tables = {
    exportedAt: value.exportedAt,
    tasks: value.tasks,
    subjects: value.subjects,
    notes: value.notes,
    events: value.events,
    flashcards: value.flashcards,
    studySessions: value.studySessions,
    settings: value.settings,
  }

  if (version === 1) {
    if (!isArrayOf(value.goals, isLegacyStudyGoal)) {
      throw new Error('Import file is not a Study Dashboard export.')
    }
    return {
      version: 2,
      ...tables,
      goals: value.goals.map((goal) => ({
        ...goal,
        metric: inferLegacyGoalMetric(goal.period, goal.title),
      })),
    }
  }

  if (!isArrayOf(value.goals, isCurrentStudyGoal)) {
    throw new Error('Import file is not a Study Dashboard export.')
  }

  return {
    version: 2,
    ...tables,
    goals: value.goals,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isArrayOf<T>(value: unknown, validate: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(validate)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isDate(value: unknown): value is string {
  return isString(value) && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isDateOrEmpty(value: unknown): value is string {
  return value === '' || isDate(value)
}

function hasRecordIdentity(record: Record<string, unknown>) {
  return isString(record.id) && record.id.length > 0
}

function hasTimestamps(record: Record<string, unknown>) {
  return isDate(record.createdAt) && isDate(record.updatedAt)
}

function isStudyTask(value: unknown): value is StudyTask {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.title) &&
    isString(value.subjectId) &&
    isDateOrEmpty(value.dueDate) &&
    (value.priority === 'low' || value.priority === 'normal' || value.priority === 'high') &&
    (value.status === 'open' || value.status === 'done') &&
    isNumber(value.minutes) &&
    hasTimestamps(value)
  )
}

function isStudySubject(value: unknown): value is StudySubject {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.name) &&
    isString(value.color) &&
    isNumber(value.targetHours) &&
    isNumber(value.progress) &&
    hasTimestamps(value)
  )
}

function isStudyNote(value: unknown): value is StudyNote {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.title) &&
    isString(value.body) &&
    isString(value.subjectId) &&
    isArrayOf(value.tags, isString) &&
    hasTimestamps(value)
  )
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.title) &&
    isString(value.subjectId) &&
    isDate(value.startAt) &&
    isDate(value.endAt) &&
    isString(value.location) &&
    hasTimestamps(value)
  )
}

function isFlashcard(value: unknown): value is Flashcard {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.front) &&
    isString(value.back) &&
    isString(value.subjectId) &&
    (value.status === 'new' || value.status === 'learning' || value.status === 'remembered') &&
    isDateOrEmpty(value.lastReviewedAt) &&
    (value.dueAt === undefined || isDate(value.dueAt)) &&
    (value.intervalDays === undefined || isNumber(value.intervalDays)) &&
    (value.reviewCount === undefined || isNumber(value.reviewCount)) &&
    hasTimestamps(value)
  )
}

function isStudySession(value: unknown): value is StudySession {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.subjectId) &&
    isDate(value.startedAt) &&
    isDate(value.endedAt) &&
    isNumber(value.minutes) &&
    isString(value.note)
  )
}

function isLegacyStudyGoal(value: unknown): value is StudyGoalV1 {
  if (!isRecord(value)) return false
  return (
    hasRecordIdentity(value) &&
    isString(value.title) &&
    isNumber(value.target) &&
    isNumber(value.progress) &&
    (value.period === 'daily' || value.period === 'weekly' || value.period === 'monthly') &&
    hasTimestamps(value)
  )
}

function isCurrentStudyGoal(value: unknown): value is StudyGoal {
  if (!isRecord(value) || !isGoalMetric(value.metric)) return false
  return isLegacyStudyGoal(value)
}

function isStudySetting(value: unknown): value is StudySetting {
  return isRecord(value) && isString(value.key) && value.key.length > 0 && 'value' in value
}

type LegacyData = {
  tasks?: Array<{ id?: string; title?: string; subject?: string; done?: boolean; minutes?: number }>
  subjects?: Array<{ id?: string; name?: string; topicsLeft?: number; progress?: number }>
  notes?: Array<{ id?: string; title?: string; tag?: string; body?: string; date?: string }>
  events?: Array<{ id?: string; time?: string; title?: string; detail?: string }>
  quickNotes?: string[]
  focusMinutes?: number
  dailyGoalMinutes?: number
}

function isLegacyDemoData(data: LegacyData) {
  return (
    data.tasks?.some((task) => task.id === 'task-1' && task.title === 'Review Calculus notes') === true &&
    data.subjects?.some((subject) => subject.id === 'subject-1' && subject.name === 'Calculus') === true
  )
}

function migrateLegacyData(data: LegacyData): StudyData {
  const createdAt = nowIso()
  const subjectMap = new Map<string, StudySubject>()
  const ensureSubject = (name?: string) => {
    const cleanName = name?.trim() || 'General'
    const existing = subjectMap.get(cleanName.toLowerCase())
    if (existing) return existing
    const subject: StudySubject = {
      id: createId('subject'),
      name: cleanName,
      color: DEFAULT_SUBJECT_COLORS[subjectMap.size % DEFAULT_SUBJECT_COLORS.length],
      targetHours: 5,
      progress: 0,
      createdAt,
      updatedAt: createdAt,
    }
    subjectMap.set(cleanName.toLowerCase(), subject)
    return subject
  }

  for (const subject of data.subjects ?? []) {
    const name = subject.name?.trim()
    if (!name) continue
    subjectMap.set(name.toLowerCase(), {
      id: subject.id?.trim() || createId('subject'),
      name,
      color: DEFAULT_SUBJECT_COLORS[subjectMap.size % DEFAULT_SUBJECT_COLORS.length],
      targetHours: Math.max(1, Math.round((subject.topicsLeft ?? 2) * 1.5)),
      progress: clamp(subject.progress ?? 0, 0, 100),
      createdAt,
      updatedAt: createdAt,
    })
  }

  const tasks = (data.tasks ?? [])
    .filter((task) => task.title?.trim())
    .map((task): StudyTask => {
      const subject = ensureSubject(task.subject)
      return {
        id: task.id?.trim() || createId('task'),
        title: task.title?.trim() ?? '',
        subjectId: subject.id,
        dueDate: '',
        priority: 'normal',
        status: task.done ? 'done' : 'open',
        minutes: clamp(task.minutes ?? 30, 5, 720),
        createdAt,
        updatedAt: createdAt,
      }
    })

  const notes = (data.notes ?? [])
    .filter((note) => note.title?.trim() || note.body?.trim())
    .map((note): StudyNote => {
      const subject = ensureSubject(note.tag)
      return {
        id: note.id?.trim() || createId('note'),
        title: note.title?.trim() || 'Untitled note',
        body: note.body?.trim() ?? '',
        subjectId: subject.id,
        tags: note.tag ? [note.tag] : [],
        createdAt,
        updatedAt: createdAt,
      }
    })

  const today = new Date().toISOString().slice(0, 10)
  const events = (data.events ?? [])
    .filter((event) => event.title?.trim())
    .map((event): CalendarEvent => {
      const startAt = legacyTimeToIso(today, event.time)
      return {
        id: event.id?.trim() || createId('event'),
        title: event.title?.trim() ?? '',
        subjectId: ensureSubject('General').id,
        startAt,
        endAt: addMinutes(startAt, 60),
        location: event.detail?.trim() ?? '',
        createdAt,
        updatedAt: createdAt,
      }
    })

  const settings: StudySetting[] = [
    { key: LEGACY_MIGRATION_KEY, value: true },
    { key: 'dailyGoalMinutes', value: clamp(data.dailyGoalMinutes ?? 240, 30, 720) },
    { key: 'quickNotes', value: (data.quickNotes ?? []).filter(Boolean).slice(0, 8) },
  ]

  if ((data.focusMinutes ?? 0) > 0) {
    const subject = ensureSubject('General')
    const endedAt = nowIso()
    return {
      tasks,
      subjects: Array.from(subjectMap.values()),
      notes,
      events,
      flashcards: [],
      studySessions: [
        {
          id: createId('session'),
          subjectId: subject.id,
          startedAt: addMinutes(endedAt, -clamp(data.focusMinutes ?? 0, 1, 720)),
          endedAt,
          minutes: clamp(data.focusMinutes ?? 0, 1, 720),
          note: 'Migrated focus time',
        },
      ],
      goals: [],
      settings,
    }
  }

  return {
    tasks,
    subjects: Array.from(subjectMap.values()),
    notes,
    events,
    flashcards: [],
    studySessions: [],
    goals: [],
    settings,
  }
}

function legacyTimeToIso(day: string, time?: string) {
  if (!time) return `${day}T09:00:00.000`
  const parsed = new Date(`${day} ${time}`)
  return Number.isNaN(parsed.getTime()) ? `${day}T09:00:00.000` : parsed.toISOString()
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
