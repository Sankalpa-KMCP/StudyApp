import Dexie, { type Table } from 'dexie'
import { inferSubjectProgressMode } from '../appUtils'
import { getAppVersion } from '../appVersion'
import { inferLegacyGoalMetric } from './goalMetricInference'
import {
  assertUniqueStudyExportIdentifiers,
  assertStudyExportSubjectReferences,
  assertStudyExportSemantics,
  assertStudyExportSettingsValues,
  assertStudyExportRecordCounts,
  STUDY_EXPORT_IMPORT_VALIDATION_ERROR,
  StudyExportValidationError,
} from './studyExportValidation'
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
  StudySubjectLegacy,
  StudyTask,
} from './types'
import { EXPORT_SCHEMA_VERSION, isGoalMetric, isSubjectProgressMode } from './types'

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
    this.version(3).stores(STUDY_DB_STORES).upgrade(async (transaction) => {
      const sessions = await transaction.table('studySessions').toArray() as StudySession[]
      await transaction.table('subjects').toCollection().modify((subject: Record<string, unknown>) => {
        if (isSubjectProgressMode(subject.progressMode)) return
        const subjectId = typeof subject.id === 'string' ? subject.id : ''
        subject.progressMode = inferSubjectProgressMode(subjectId, sessions)
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

export async function readStudyDataSnapshot(): Promise<StudyData> {
  return studyDb.transaction('r', studyTables, async () => {
    return getStudyData()
  })
}

export function createStudyExportPayload(
  snapshot: StudyData,
  exportedAt = nowIso(),
  appVersion = getAppVersion()
): StudyExport {
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    ...snapshot,
  }
}

export async function exportStudyData(): Promise<StudyExport> {
  const snapshot = await readStudyDataSnapshot()
  return createStudyExportPayload(snapshot)
}

export async function importStudyData(payload: unknown): Promise<void> {
  const normalized = parseAndNormalizeStudyExport(payload)

  try {
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
  } catch (err) {
    if (err instanceof StudyExportValidationError) {
      throw err
    }
    throw new StudyExportValidationError(
      'transaction_failed',
      'Database storage transaction failed during import.'
    )
  }
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
      studyDb.settings.delete('onboardingChecklistDismissed'),
    ])
  })
}

export type MigrationResult =
  | { status: 'already_migrated' }
  | { status: 'no_legacy_data' }
  | { status: 'demo_data_skipped' }
  | { status: 'empty_data_skipped' }
  | { status: 'success'; recordCount: number }
  | { status: 'invalid_data'; reason: string }
  | { status: 'collision'; entity: string; id: string }
  | { status: 'transaction_failed'; error: string }
  | { status: 'cleanup_failed' }

export class LegacyMigrationCollisionError extends Error {
  entity: string
  id: string

  constructor(entity: string, id: string) {
    super(`Collision detected for entity '${entity}' with ID '${id}'.`)
    this.entity = entity
    this.id = id
    this.name = 'LegacyMigrationCollisionError'
  }
}

export interface TestMigrationHooks {
  beforeEntityWrite?: () => void | Promise<void>
  beforeMarkerWrite?: () => void | Promise<void>
  forceQuotaError?: boolean
  abortTransaction?: boolean
}

function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, idx) => isStructurallyEqual(item, b[idx]))
  }
  const keysA = Object.keys(a as object)
    .filter((k) => (a as Record<string, unknown>)[k] !== undefined)
    .sort()
  const keysB = Object.keys(b as object)
    .filter((k) => (b as Record<string, unknown>)[k] !== undefined)
    .sort()
  if (keysA.length !== keysB.length) return false
  if (!keysA.every((k, idx) => k === keysB[idx])) return false
  return keysA.every((k) =>
    isStructurallyEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  )
}

function processIncomingTable<T extends { id: string }>(entityName: string, records: T[]): T[] {
  const map = new Map<string, T>()
  for (const record of records) {
    const existing = map.get(record.id)
    if (existing) {
      if (isStructurallyEqual(existing, record)) {
        continue
      } else {
        throw new LegacyMigrationCollisionError(entityName, record.id)
      }
    }
    map.set(record.id, record)
  }
  return Array.from(map.values())
}

async function checkAndFilterExistingRows<T extends { id: string }>(
  entityName: string,
  table: Table<T, string>,
  incomingRecords: T[]
): Promise<T[]> {
  const recordsToAdd: T[] = []
  for (const record of incomingRecords) {
    const existing = await table.get(record.id)
    if (existing) {
      if (isStructurallyEqual(existing, record)) {
        continue
      } else {
        throw new LegacyMigrationCollisionError(entityName, record.id)
      }
    }
    recordsToAdd.push(record)
  }
  return recordsToAdd
}

export async function migrateLegacyLocalStorage(
  _testHooks?: TestMigrationHooks
): Promise<MigrationResult> {
  if (typeof window === 'undefined') {
    return { status: 'no_legacy_data' }
  }

  try {
    const migration = await studyDb.settings.get(LEGACY_MIGRATION_KEY)
    if (migration?.value === true) {
      const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw !== null) {
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        } catch {
          return { status: 'cleanup_failed' }
        }
      }
      return { status: 'already_migrated' }
    }

    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      return { status: 'no_legacy_data' }
    }

    let parsed: LegacyData
    try {
      parsed = JSON.parse(raw) as LegacyData
    } catch {
      return { status: 'invalid_data', reason: 'Invalid JSON format in legacy storage' }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'invalid_data', reason: 'Legacy storage payload is not a valid object' }
    }

    if (isLegacyDemoData(parsed)) {
      try {
        await studyDb.transaction('rw', studyTables, async () => {
          if (_testHooks?.beforeMarkerWrite) _testHooks.beforeMarkerWrite()
          if (_testHooks?.forceQuotaError) {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError')
          }
          await studyDb.settings.put({ key: LEGACY_MIGRATION_KEY, value: true })
        })
      } catch (err) {
        return {
          status: 'transaction_failed',
          error: err instanceof Error ? err.message : String(err),
        }
      }

      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        return { status: 'cleanup_failed' }
      }
      return { status: 'demo_data_skipped' }
    }

    let migrated: StudyData
    try {
      migrated = migrateLegacyData(parsed)
    } catch (err) {
      return {
        status: 'invalid_data',
        reason: err instanceof Error ? err.message : 'Failed to normalize legacy data',
      }
    }

    let deduplicatedTasks: StudyTask[]
    let deduplicatedSubjects: StudySubject[]
    let deduplicatedNotes: StudyNote[]
    let deduplicatedEvents: CalendarEvent[]
    let deduplicatedFlashcards: Flashcard[]
    let deduplicatedSessions: StudySession[]
    let deduplicatedGoals: StudyGoal[]

    try {
      deduplicatedTasks = processIncomingTable('tasks', migrated.tasks)
      deduplicatedSubjects = processIncomingTable('subjects', migrated.subjects)
      deduplicatedNotes = processIncomingTable('notes', migrated.notes)
      deduplicatedEvents = processIncomingTable('events', migrated.events)
      deduplicatedFlashcards = processIncomingTable('flashcards', migrated.flashcards)
      deduplicatedSessions = processIncomingTable('studySessions', migrated.studySessions)
      deduplicatedGoals = processIncomingTable('goals', migrated.goals)
    } catch (err) {
      if (err instanceof LegacyMigrationCollisionError) {
        return { status: 'collision', entity: err.entity, id: err.id }
      }
      return {
        status: 'invalid_data',
        reason: err instanceof Error ? err.message : 'Failed to validate incoming duplicates',
      }
    }

    const recordCount =
      deduplicatedTasks.length +
      deduplicatedSubjects.length +
      deduplicatedNotes.length +
      deduplicatedEvents.length +
      deduplicatedFlashcards.length +
      deduplicatedSessions.length +
      deduplicatedGoals.length

    if (recordCount === 0) {
      try {
        await studyDb.transaction('rw', studyTables, async () => {
          if (_testHooks?.beforeMarkerWrite) _testHooks.beforeMarkerWrite()
          if (_testHooks?.forceQuotaError) {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError')
          }
          await studyDb.settings.put({ key: LEGACY_MIGRATION_KEY, value: true })
        })
      } catch (err) {
        return {
          status: 'transaction_failed',
          error: err instanceof Error ? err.message : String(err),
        }
      }

      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        return { status: 'cleanup_failed' }
      }
      return { status: 'empty_data_skipped' }
    }

    let alreadyMigratedInTx = false

    await studyDb.transaction('rw', studyTables, async () => {
      const inTxMigration = await studyDb.settings.get(LEGACY_MIGRATION_KEY)
      if (inTxMigration?.value === true) {
        alreadyMigratedInTx = true
        return
      }

      const tasksToAdd = await checkAndFilterExistingRows('tasks', studyDb.tasks, deduplicatedTasks)
      const subjectsToAdd = await checkAndFilterExistingRows(
        'subjects',
        studyDb.subjects,
        deduplicatedSubjects
      )
      const notesToAdd = await checkAndFilterExistingRows('notes', studyDb.notes, deduplicatedNotes)
      const eventsToAdd = await checkAndFilterExistingRows('events', studyDb.events, deduplicatedEvents)
      const flashcardsToAdd = await checkAndFilterExistingRows(
        'flashcards',
        studyDb.flashcards,
        deduplicatedFlashcards
      )
      const sessionsToAdd = await checkAndFilterExistingRows(
        'studySessions',
        studyDb.studySessions,
        deduplicatedSessions
      )
      const goalsToAdd = await checkAndFilterExistingRows('goals', studyDb.goals, deduplicatedGoals)

      if (_testHooks?.beforeEntityWrite) {
        await _testHooks.beforeEntityWrite()
      }

      await Promise.all([
        studyDb.subjects.bulkAdd(subjectsToAdd),
        studyDb.tasks.bulkAdd(tasksToAdd),
        studyDb.notes.bulkAdd(notesToAdd),
        studyDb.events.bulkAdd(eventsToAdd),
        studyDb.flashcards.bulkAdd(flashcardsToAdd),
        studyDb.studySessions.bulkAdd(sessionsToAdd),
        studyDb.goals.bulkAdd(goalsToAdd),
      ])

      const settingsToPut = migrated.settings.filter((s) => s.key !== LEGACY_MIGRATION_KEY)
      if (settingsToPut.length > 0) {
        await studyDb.settings.bulkPut(settingsToPut)
      }

      if (_testHooks?.beforeMarkerWrite) {
        await _testHooks.beforeMarkerWrite()
      }
      if (_testHooks?.forceQuotaError) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      }
      if (_testHooks?.abortTransaction) {
        throw new Error('Explicit transaction abort')
      }

      await studyDb.settings.put({ key: LEGACY_MIGRATION_KEY, value: true })
    })

    if (alreadyMigratedInTx) {
      return { status: 'already_migrated' }
    }

    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      return { status: 'cleanup_failed' }
    }

    return { status: 'success', recordCount }
  } catch (err) {
    if (err instanceof LegacyMigrationCollisionError) {
      return { status: 'collision', entity: err.entity, id: err.id }
    }
    return {
      status: 'transaction_failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}


/**
 * Validates a version-1, version-2, or version-3 backup and normalizes it to the current export shape.
 * Throws before any database mutation when the payload is unsupported or invalid.
 */
export function parseAndNormalizeStudyExport(value: unknown): StudyExport {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new StudyExportValidationError(
        'invalid_json',
        'Import file contains invalid JSON syntax.'
      )
    }
  }

  if (!isRecord(parsed)) {
    throw new StudyExportValidationError(
      'invalid_structure',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  const version = parsed.version
  if (typeof version !== 'number') {
    throw new StudyExportValidationError(
      'invalid_structure',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  if (version > EXPORT_SCHEMA_VERSION) {
    throw new StudyExportValidationError(
      'future_version',
      `Import file schema version (${version}) is newer than supported version (${EXPORT_SCHEMA_VERSION}).`,
      { encounteredVersion: version }
    )
  }

  if (version < 1) {
    throw new StudyExportValidationError(
      'unsupported_old_version',
      `Import file schema version (${version}) is unsupported.`,
      { encounteredVersion: version }
    )
  }

  if (version !== 1 && version !== 2 && version !== 3) {
    throw new StudyExportValidationError(
      'invalid_structure',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  if (parsed.appVersion !== undefined) {
    if (
      typeof parsed.appVersion !== 'string'
      || parsed.appVersion.trim().length === 0
      || parsed.appVersion.length > 64
    ) {
      throw new StudyExportValidationError(
        'invalid_records',
        'Import file contains invalid app version metadata.'
      )
    }
  }

  if (
    !isDate(parsed.exportedAt)
    || !isArrayOf(parsed.tasks, isStudyTask)
    || !isArrayOf(parsed.notes, isStudyNote)
    || !isArrayOf(parsed.events, isCalendarEvent)
    || !isArrayOf(parsed.flashcards, isFlashcard)
    || !isArrayOf(parsed.studySessions, isStudySession)
    || !isArrayOf(parsed.settings, isStudySetting)
  ) {
    throw new StudyExportValidationError(
      'invalid_structure',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  const studySessions = parsed.studySessions

  if (version === 3) {
    if (!isArrayOf(parsed.subjects, isStudySubject) || !isArrayOf(parsed.goals, isCurrentStudyGoal)) {
      throw new StudyExportValidationError(
        'invalid_records',
        STUDY_EXPORT_IMPORT_VALIDATION_ERROR
      )
    }
    return finalizeStudyExport({
      version: 3,
      exportedAt: parsed.exportedAt,
      appVersion: parsed.appVersion,
      tasks: parsed.tasks,
      subjects: parsed.subjects,
      notes: parsed.notes,
      events: parsed.events,
      flashcards: parsed.flashcards,
      studySessions,
      goals: parsed.goals,
      settings: parsed.settings,
    })
  }

  if (!isArrayOf(parsed.subjects, isLegacyStudySubject)) {
    throw new StudyExportValidationError(
      'invalid_records',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  const subjects = normalizeLegacySubjects(parsed.subjects, studySessions)
  const tables = {
    exportedAt: parsed.exportedAt,
    appVersion: parsed.appVersion,
    tasks: parsed.tasks,
    subjects,
    notes: parsed.notes,
    events: parsed.events,
    flashcards: parsed.flashcards,
    studySessions,
    settings: parsed.settings,
  }

  if (version === 1) {
    if (!isArrayOf(parsed.goals, isLegacyStudyGoal)) {
      throw new StudyExportValidationError(
        'invalid_records',
        STUDY_EXPORT_IMPORT_VALIDATION_ERROR
      )
    }
    return finalizeStudyExport({
      version: 3,
      ...tables,
      goals: parsed.goals.map((goal) => ({
        ...goal,
        metric: inferLegacyGoalMetric(goal.period, goal.title),
      })),
    })
  }

  if (!isArrayOf(parsed.goals, isCurrentStudyGoal)) {
    throw new StudyExportValidationError(
      'invalid_records',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  return finalizeStudyExport({
    version: 3,
    ...tables,
    goals: parsed.goals,
  })
}

function finalizeStudyExport(snapshot: StudyExport): StudyExport {
  assertUniqueStudyExportIdentifiers(snapshot)
  assertStudyExportSubjectReferences(snapshot)
  assertStudyExportSemantics(snapshot)
  assertStudyExportSettingsValues(snapshot)
  assertStudyExportRecordCounts(snapshot)
  return snapshot
}

function normalizeLegacySubjects(subjects: StudySubjectLegacy[], sessions: StudySession[]): StudySubject[] {
  return subjects.map((subject) => ({
    ...subject,
    progressMode: inferSubjectProgressMode(subject.id, sessions),
  }))
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

function isLegacyStudySubject(value: unknown): value is StudySubjectLegacy {
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

function isStudySubject(value: unknown): value is StudySubject {
  if (!isRecord(value) || !isSubjectProgressMode(value.progressMode)) return false
  return isLegacyStudySubject(value)
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
      progressMode: 'manual',
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
      progressMode: 'manual',
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
    const studySessions: StudySession[] = [
      {
        id: createId('session'),
        subjectId: subject.id,
        startedAt: addMinutes(endedAt, -clamp(data.focusMinutes ?? 0, 1, 720)),
        endedAt,
        minutes: clamp(data.focusMinutes ?? 0, 1, 720),
        note: 'Migrated focus time',
      },
    ]
    return {
      tasks,
      subjects: Array.from(subjectMap.values()).map((entry) => ({
        ...entry,
        progressMode: inferSubjectProgressMode(entry.id, studySessions),
      })),
      notes,
      events,
      flashcards: [],
      studySessions,
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
