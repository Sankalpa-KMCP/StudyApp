import Dexie, { type Table } from 'dexie'
import type {
  CalendarEvent,
  Flashcard,
  StudyData,
  StudyExport,
  StudyGoal,
  StudyNote,
  StudySession,
  StudySetting,
  StudySubject,
  StudyTask,
} from './types'

const STUDY_DB_NAME = 'study-dashboard-db'
const LEGACY_STORAGE_KEY = 'study-dashboard-v2'
const LEGACY_MIGRATION_KEY = 'legacy-localstorage-migrated-v1'
const DEFAULT_SUBJECT_COLORS = ['#111827', '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c']

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
    this.version(1).stores({
      tasks: '&id, status, priority, dueDate, subjectId, createdAt, updatedAt',
      subjects: '&id, name, color, createdAt, updatedAt',
      notes: '&id, subjectId, createdAt, updatedAt, *tags',
      events: '&id, subjectId, startAt, endAt, createdAt, updatedAt',
      flashcards: '&id, subjectId, status, lastReviewedAt, createdAt, updatedAt',
      studySessions: '&id, subjectId, startedAt, endedAt',
      goals: '&id, period, createdAt, updatedAt',
      settings: '&key',
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
    version: 1,
    exportedAt: nowIso(),
    ...(await getStudyData()),
  }
}

export async function importStudyData(payload: unknown) {
  if (!isStudyExport(payload)) {
    throw new Error('Import file is not a Study Dashboard export.')
  }

  await studyDb.transaction('rw', studyTables, async () => {
    await Promise.all(studyTables.map((table) => table.clear()))
    await Promise.all([
      studyDb.tasks.bulkPut(payload.tasks),
      studyDb.subjects.bulkPut(payload.subjects),
      studyDb.notes.bulkPut(payload.notes),
      studyDb.events.bulkPut(payload.events),
      studyDb.flashcards.bulkPut(payload.flashcards),
      studyDb.studySessions.bulkPut(payload.studySessions),
      studyDb.goals.bulkPut(payload.goals),
      studyDb.settings.bulkPut(payload.settings),
    ])
  })
}

export async function clearStudyData() {
  await studyDb.transaction('rw', studyTables, async () => {
    await Promise.all(studyTables.map((table) => table.clear()))
    await studyDb.settings.put({ key: LEGACY_MIGRATION_KEY, value: true })
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

function isStudyExport(value: unknown): value is StudyExport {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.version === 1 &&
    Array.isArray(record.tasks) &&
    Array.isArray(record.subjects) &&
    Array.isArray(record.notes) &&
    Array.isArray(record.events) &&
    Array.isArray(record.flashcards) &&
    Array.isArray(record.studySessions) &&
    Array.isArray(record.goals) &&
    Array.isArray(record.settings)
  )
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
