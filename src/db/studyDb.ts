import Dexie, { type Table } from 'dexie'
import { getSubjectStudyMinutesMap, inferSubjectProgressMode } from '../appUtils'
import { getAppVersion } from '../appVersion'
import { inferLegacyGoalMetric } from './goalMetricInference'
import {
  withExclusiveDatabaseLock,
  withSharedDatabaseLock,
  WebLocksUnavailableError,
} from './crossTabLock'
import {
  advanceDatabaseGeneration,
  DATABASE_GENERATION_KEY,
  DatabaseGenerationOverflowError,
  getDatabaseGeneration,
} from './databaseGeneration'
import {
  assertUniqueStudyExportIdentifiers,
  assertStudyExportSubjectReferences,
  assertStudyExportSemantics,
  assertStudyExportSettingsValues,
  assertStudyExportRecordCounts,
  STUDY_EXPORT_IMPORT_VALIDATION_ERROR,
  StudyExportValidationError,
} from './studyExportValidation'
import { isPersistedDueDate, isPersistedIsoTimestamp } from './validation/persistedInvariants'
import type {
  CalendarEvent,
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

const LEGACY_EVENT_START_REGEX = /^(\d{4})-(\d{2})-(\d{2})T09:00:00(\.000)?$/

export function isLegacyEventStartTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = LEGACY_EVENT_START_REGEX.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function reconstructLegacyEventStartTimestamp(endAt: string): string {
  return new Date(new Date(endAt).getTime() - 60 * 60_000).toISOString()
}

function isGoalPeriod(value: unknown): value is GoalPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

export class StudyDatabase extends Dexie {
  tasks!: Table<StudyTask, string>
  subjects!: Table<StudySubject, string>
  notes!: Table<StudyNote, string>
  events!: Table<CalendarEvent, string>
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
      const minutesMap = getSubjectStudyMinutesMap(sessions)
      await transaction.table('subjects').toCollection().modify((subject: Record<string, unknown>) => {
        if (isSubjectProgressMode(subject.progressMode)) return
        const subjectId = typeof subject.id === 'string' ? subject.id : ''
        subject.progressMode = inferSubjectProgressMode(subjectId, minutesMap)
      })
    })
    this.version(4).stores({
      flashcards: null,
    })
    this.version(5).upgrade(async (transaction) => {
      const events = transaction.table('events')
      await events.toCollection().modify((event: Record<string, unknown>) => {
        if (typeof event.startAt === 'string' && !isPersistedIsoTimestamp(event.startAt)) {
          if (isLegacyEventStartTimestamp(event.startAt) && typeof event.endAt === 'string' && isPersistedIsoTimestamp(event.endAt)) {
            event.startAt = reconstructLegacyEventStartTimestamp(event.endAt)
          }
        }
      })
    })
  }
}

export const studyDb = new StudyDatabase()

export const studyTables = [
  studyDb.tasks,
  studyDb.subjects,
  studyDb.notes,
  studyDb.events,
  studyDb.studySessions,
  studyDb.goals,
  studyDb.settings,
] as const

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${Date.now()}-${crypto.randomUUID()}`
  }
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `${prefix}-${Date.now()}-${rand}`
}

export function nowIso() {
  return new Date().toISOString()
}

export async function getStudyData(): Promise<StudyData> {
  const [tasks, subjects, notes, events, studySessions, goals, settings] = await Promise.all([
    studyDb.tasks.orderBy('createdAt').toArray(),
    studyDb.subjects.orderBy('createdAt').toArray(),
    studyDb.notes.orderBy('updatedAt').reverse().toArray(),
    studyDb.events.orderBy('startAt').toArray(),
    studyDb.studySessions.orderBy('startedAt').reverse().toArray(),
    studyDb.goals.orderBy('createdAt').toArray(),
    studyDb.settings.toArray(),
  ])

  return { tasks, subjects, notes, events, studySessions, goals, settings }
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
  const portableSettings = snapshot.settings.filter(
    (setting) => setting.key !== LEGACY_MIGRATION_KEY && setting.key !== DATABASE_GENERATION_KEY
  )
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    ...snapshot,
    settings: portableSettings,
  }
}

export async function exportStudyData(): Promise<StudyExport> {
  return withSharedDatabaseLock(async () => {
    const snapshot = await readStudyDataSnapshot()
    return createStudyExportPayload(snapshot)
  })
}

export type ImportStudyDataResult = {
  warning?: 'cleanup_failed'
}

export interface TestImportHooks {
  forceQuotaError?: boolean
  abortTransaction?: boolean
  forceCleanupError?: boolean
  forceSettingsPutError?: boolean
}

export async function importStudyData(
  payload: unknown,
  _testHooks?: TestImportHooks
): Promise<ImportStudyDataResult> {
  const normalized = parseAndNormalizeStudyExport(payload)

  const portableSettings = normalized.settings.filter(
    (setting) => setting.key !== LEGACY_MIGRATION_KEY && setting.key !== DATABASE_GENERATION_KEY
  )

  try {
    await withExclusiveDatabaseLock(async () => {
      await studyDb.transaction('rw', studyTables, async () => {
        const currentGen = await getDatabaseGeneration(studyDb.settings)
        if (currentGen >= Number.MAX_SAFE_INTEGER) {
          throw new DatabaseGenerationOverflowError()
        }
        const nextGeneration = currentGen + 1

        await Promise.all(studyTables.map((table) => table.clear()))

        if (_testHooks?.forceQuotaError) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError')
        }
        if (_testHooks?.abortTransaction) {
          throw new Error('Explicit transaction abort')
        }
        if (_testHooks?.forceSettingsPutError) {
          throw new Error('Forced settings put error')
        }

        const settingsToPut: StudySetting[] = [
          ...portableSettings,
          { key: LEGACY_MIGRATION_KEY, value: true },
          { key: DATABASE_GENERATION_KEY, value: nextGeneration },
        ]

        await Promise.all([
          studyDb.tasks.bulkPut(normalized.tasks),
          studyDb.subjects.bulkPut(normalized.subjects),
          studyDb.notes.bulkPut(normalized.notes),
          studyDb.events.bulkPut(normalized.events),
          studyDb.studySessions.bulkPut(normalized.studySessions),
          studyDb.goals.bulkPut(normalized.goals),
          studyDb.settings.bulkPut(settingsToPut),
        ])
      })
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

  if (typeof window !== 'undefined') {
    try {
      if (_testHooks?.forceCleanupError) {
        throw new Error('Forced cleanup error')
      }
      const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw !== null) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    } catch {
      return { warning: 'cleanup_failed' }
    }
  }

  return {}
}

export async function clearAllStudyData(): Promise<number> {
  let nextGeneration = 1
  await withExclusiveDatabaseLock(async () => {
    await studyDb.transaction('rw', studyTables, async () => {
      const currentGen = await getDatabaseGeneration(studyDb.settings)
      if (currentGen >= Number.MAX_SAFE_INTEGER) {
        throw new DatabaseGenerationOverflowError()
      }
      nextGeneration = currentGen + 1

      await Promise.all([
        studyDb.tasks.clear(),
        studyDb.subjects.clear(),
        studyDb.notes.clear(),
        studyDb.events.clear(),
        studyDb.studySessions.clear(),
        studyDb.goals.clear(),
      ])

      // Clean up study-related settings but preserve preference, migration, and generation keys
      // (`dailyGoalMinutes`, `legacy-localstorage-migrated-v1`, `databaseGeneration`). Theme lives in localStorage.
      // Key must match ACTIVE_FOCUS_SESSION_KEY in activeFocusSession.ts.
      await Promise.all([
        studyDb.settings.delete('quickNotes'),
        studyDb.settings.delete('activeFocusSession'),
        studyDb.settings.delete('onboardingChecklistDismissed'),
        studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: nextGeneration }),
      ])
    })
  })
  return nextGeneration
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
  beforeTransactionAcquisition?: () => void | Promise<void>
  beforeEntityWrite?: () => void | Promise<void>
  beforeMarkerWrite?: () => void | Promise<void>
  forceQuotaError?: boolean
  forceEntityWriteError?: boolean
  forceMarkerWriteError?: boolean
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
    return await withExclusiveDatabaseLock(async () => {
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
      let deduplicatedSessions: StudySession[]
      let deduplicatedGoals: StudyGoal[]

      try {
        deduplicatedTasks = processIncomingTable('tasks', migrated.tasks)
        deduplicatedSubjects = processIncomingTable('subjects', migrated.subjects)
        deduplicatedNotes = processIncomingTable('notes', migrated.notes)
        deduplicatedEvents = processIncomingTable('events', migrated.events)
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

      if (_testHooks?.beforeTransactionAcquisition) {
        await _testHooks.beforeTransactionAcquisition()
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
        const sessionsToAdd = await checkAndFilterExistingRows(
          'studySessions',
          studyDb.studySessions,
          deduplicatedSessions
        )
        const goalsToAdd = await checkAndFilterExistingRows('goals', studyDb.goals, deduplicatedGoals)

        if (_testHooks?.beforeEntityWrite) {
          await _testHooks.beforeEntityWrite()
        }
        if (_testHooks?.forceEntityWriteError) {
          throw new Error('Forced entity write error')
        }

        await Promise.all([
          studyDb.subjects.bulkAdd(subjectsToAdd),
          studyDb.tasks.bulkAdd(tasksToAdd),
          studyDb.notes.bulkAdd(notesToAdd),
          studyDb.events.bulkAdd(eventsToAdd),
          studyDb.studySessions.bulkAdd(sessionsToAdd),
          studyDb.goals.bulkAdd(goalsToAdd),
        ])

        const settingsToPut = migrated.settings.filter(
          (s) => s.key !== LEGACY_MIGRATION_KEY && s.key !== DATABASE_GENERATION_KEY
        )
        if (settingsToPut.length > 0) {
          await studyDb.settings.bulkPut(settingsToPut)
        }

        await advanceDatabaseGeneration(studyDb.settings)

        if (_testHooks?.beforeMarkerWrite) {
          await _testHooks.beforeMarkerWrite()
        }
        if (_testHooks?.forceMarkerWriteError) {
          throw new Error('Forced marker write error')
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
    })
  } catch (err) {
    if (err instanceof LegacyMigrationCollisionError) {
      return { status: 'collision', entity: err.entity, id: err.id }
    }
    if (err instanceof WebLocksUnavailableError) {
      return {
        status: 'transaction_failed',
        error: 'Web Locks API is unavailable',
      }
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

  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
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
    || !isArrayOf(parsed.studySessions, isStudySession)
    || !isArrayOf(parsed.settings, isStudySetting)
  ) {
    throw new StudyExportValidationError(
      'invalid_structure',
      STUDY_EXPORT_IMPORT_VALIDATION_ERROR
    )
  }

  if (version <= 3 && parsed.flashcards !== undefined) {
    if (!isArrayOf(parsed.flashcards, isLegacyFlashcard)) {
      throw new StudyExportValidationError(
        'invalid_records',
        STUDY_EXPORT_IMPORT_VALIDATION_ERROR
      )
    }
  }

  const studySessions = parsed.studySessions

  if (version === 4) {
    if (!isArrayOf(parsed.subjects, isStudySubject) || !isArrayOf(parsed.goals, isCurrentStudyGoal)) {
      throw new StudyExportValidationError(
        'invalid_records',
        STUDY_EXPORT_IMPORT_VALIDATION_ERROR
      )
    }
    return finalizeStudyExport({
      version: 4,
      exportedAt: parsed.exportedAt,
      appVersion: parsed.appVersion,
      tasks: parsed.tasks,
      subjects: parsed.subjects,
      notes: parsed.notes,
      events: normalizeLegacyEvents(parsed.events),
      studySessions,
      goals: parsed.goals,
      settings: parsed.settings,
    })
  }

  if (version === 3) {
    if (!isArrayOf(parsed.subjects, isStudySubject) || !isArrayOf(parsed.goals, isCurrentStudyGoal)) {
      throw new StudyExportValidationError(
        'invalid_records',
        STUDY_EXPORT_IMPORT_VALIDATION_ERROR
      )
    }
    return finalizeStudyExport({
      version: 4,
      exportedAt: parsed.exportedAt,
      appVersion: parsed.appVersion,
      tasks: parsed.tasks,
      subjects: parsed.subjects,
      notes: parsed.notes,
      events: normalizeLegacyEvents(parsed.events),
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
    events: normalizeLegacyEvents(parsed.events),
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
      version: 4,
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
    version: 4,
    ...tables,
    goals: parsed.goals,
  })
}

function normalizeImportActiveFocusSession(
  settings: StudySetting[],
  studySessions: StudySession[],
): StudySetting[] {
  const activeFocusIndex = settings.findIndex((s) => s.key === 'activeFocusSession')
  if (activeFocusIndex === -1) return settings

  const activeFocusSetting = settings[activeFocusIndex]
  const val = activeFocusSetting.value
  if (!isRecord(val) || typeof val.id !== 'string' || !val.id) {
    return settings
  }

  const sessionIds = new Set(studySessions.map((s) => s.id))
  if (sessionIds.has(val.id)) {
    let freshId = createId('focus')
    while (sessionIds.has(freshId)) {
      freshId = createId('focus')
    }
    const updatedSetting: StudySetting = {
      ...activeFocusSetting,
      value: {
        ...val,
        id: freshId,
      },
    }
    const updatedSettings = [...settings]
    updatedSettings[activeFocusIndex] = updatedSetting
    return updatedSettings
  }

  return settings
}

function finalizeStudyExport(snapshot: StudyExport): StudyExport {
  const normalizedSettings = normalizeImportActiveFocusSession(snapshot.settings, snapshot.studySessions)
  const normalizedSnapshot = normalizedSettings === snapshot.settings ? snapshot : { ...snapshot, settings: normalizedSettings }
  assertUniqueStudyExportIdentifiers(normalizedSnapshot)
  assertStudyExportSubjectReferences(normalizedSnapshot)
  assertStudyExportSemantics(normalizedSnapshot)
  assertStudyExportSettingsValues(normalizedSnapshot)
  assertStudyExportRecordCounts(normalizedSnapshot)
  return normalizedSnapshot
}

function normalizeLegacyEvent(event: CalendarEvent): CalendarEvent {
  if (isLegacyEventStartTimestamp(event.startAt) && isPersistedIsoTimestamp(event.endAt)) {
    return {
      ...event,
      startAt: reconstructLegacyEventStartTimestamp(event.endAt),
    }
  }
  return event
}

function normalizeLegacyEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.map(normalizeLegacyEvent)
}

function normalizeLegacySubjects(subjects: StudySubjectLegacy[], sessions: StudySession[]): StudySubject[] {
  const minutesMap = getSubjectStudyMinutesMap(sessions)
  return subjects.map((subject) => ({
    ...subject,
    progressMode: inferSubjectProgressMode(subject.id, minutesMap),
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
  return isPersistedIsoTimestamp(value)
}

function isDateOrEmpty(value: unknown): value is string {
  return value === '' || isPersistedIsoTimestamp(value)
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
    isPersistedDueDate(value.dueDate) &&
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
  const validStart = isDate(value.startAt) || (isLegacyEventStartTimestamp(value.startAt) && isDate(value.endAt))
  return (
    hasRecordIdentity(value) &&
    isString(value.title) &&
    isString(value.subjectId) &&
    validStart &&
    isDate(value.endAt) &&
    isString(value.location) &&
    hasTimestamps(value)
  )
}

function isLegacyFlashcard(value: unknown): value is Record<string, unknown> {
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

function isLegacyDemoData(data: LegacyData): boolean {
  if (!Array.isArray(data.tasks) || data.tasks.length !== 1) return false
  if (!Array.isArray(data.subjects) || data.subjects.length !== 1) return false

  const task = data.tasks[0]
  if (
    !task ||
    task.id !== 'task-1' ||
    task.title?.trim() !== 'Review Calculus notes' ||
    task.subject?.trim() !== 'Calculus' ||
    task.done !== true ||
    task.minutes !== 45
  ) {
    return false
  }

  const subject = data.subjects[0]
  if (
    !subject ||
    subject.id !== 'subject-1' ||
    subject.name?.trim() !== 'Calculus' ||
    subject.topicsLeft !== 4 ||
    subject.progress !== 60
  ) {
    return false
  }

  if (data.notes && data.notes.some((note) => Boolean(note.title?.trim() || note.body?.trim()))) {
    return false
  }

  if (data.events && data.events.some((event) => Boolean(event.title?.trim()))) {
    return false
  }

  if (data.quickNotes && data.quickNotes.some((qn) => Boolean(qn.trim()))) {
    return false
  }

  if (typeof data.focusMinutes === 'number' && data.focusMinutes > 0) {
    return false
  }

  if (
    typeof data.dailyGoalMinutes === 'number' &&
    data.dailyGoalMinutes !== 240
  ) {
    return false
  }

  return true
}

function migrateLegacyData(data: LegacyData): StudyData {
  const createdAt = nowIso()
  const subjects: StudySubject[] = []
  const exactNameMap = new Map<string, StudySubject[]>()
  const lowerNameMap = new Map<string, StudySubject[]>()

  const registerSubject = (subject: StudySubject) => {
    subjects.push(subject)
    const exactName = subject.name.trim()
    const lowerName = exactName.toLowerCase()

    const exactList = exactNameMap.get(exactName) ?? []
    exactList.push(subject)
    exactNameMap.set(exactName, exactList)

    const lowerList = lowerNameMap.get(lowerName) ?? []
    lowerList.push(subject)
    lowerNameMap.set(lowerName, lowerList)
  }

  for (const subject of data.subjects ?? []) {
    const name = subject.name?.trim()
    if (!name) continue
    registerSubject({
      id: subject.id?.trim() || createId('subject'),
      name,
      color: DEFAULT_SUBJECT_COLORS[subjects.length % DEFAULT_SUBJECT_COLORS.length],
      targetHours: Math.max(1, Math.round((subject.topicsLeft ?? 2) * 1.5)),
      progress: clamp(subject.progress ?? 0, 0, 100),
      progressMode: 'manual',
      createdAt,
      updatedAt: createdAt,
    })
  }

  const ensureSubject = (name?: string): StudySubject => {
    const cleanName = name?.trim() || 'General'
    const exactMatches = exactNameMap.get(cleanName)
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches[0]
    }
    const lowerMatches = lowerNameMap.get(cleanName.toLowerCase())
    if (lowerMatches && lowerMatches.length > 0) {
      return lowerMatches[0]
    }
    const newSubject: StudySubject = {
      id: createId('subject'),
      name: cleanName,
      color: DEFAULT_SUBJECT_COLORS[subjects.length % DEFAULT_SUBJECT_COLORS.length],
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
      createdAt,
      updatedAt: createdAt,
    }
    registerSubject(newSubject)
    return newSubject
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
      subjects: subjects.map((entry) => ({
        ...entry,
        progressMode: inferSubjectProgressMode(entry.id, studySessions),
      })),
      notes,
      events,
      studySessions,
      goals: [],
      settings,
    }
  }

  return {
    tasks,
    subjects,
    notes,
    events,
    studySessions: [],
    goals: [],
    settings,
  }
}

function legacyTimeToIso(day: string, time?: string): string {
  const cleanTime = time?.trim()
  if (cleanTime) {
    const parsed = new Date(`${day} ${cleanTime}`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim())
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const date = Number(match[3])
    const localDate = new Date(year, month, date, 9, 0, 0, 0)
    if (
      !Number.isNaN(localDate.getTime()) &&
      localDate.getFullYear() === year &&
      localDate.getMonth() === month &&
      localDate.getDate() === date
    ) {
      return localDate.toISOString()
    }
  }
  return `${day}T09:00:00.000Z`
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
