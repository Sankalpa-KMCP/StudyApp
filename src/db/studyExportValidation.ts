import { ACTIVE_FOCUS_SESSION_KEY, isActiveFocusSession } from './activeFocusSession'
import type { StudyExport } from './types'

/** Stable internal error; Settings maps import failures to a fixed friendly message. */
export const STUDY_EXPORT_IMPORT_VALIDATION_ERROR = 'Import file is not a Study Dashboard export.'

function assertUniqueKeys(keys: string[]): void {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
    }
    seen.add(key)
  }
}

/**
 * Rejects duplicate primary keys within each table (and duplicate settings keys).
 * Cross-table identifier reuse is allowed. Call after legacy normalization, before any IDB write.
 */
export function assertUniqueStudyExportIdentifiers(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'goals' | 'settings'
  >,
): void {
  assertUniqueKeys(snapshot.subjects.map((row) => row.id))
  assertUniqueKeys(snapshot.tasks.map((row) => row.id))
  assertUniqueKeys(snapshot.notes.map((row) => row.id))
  assertUniqueKeys(snapshot.events.map((row) => row.id))
  assertUniqueKeys(snapshot.flashcards.map((row) => row.id))
  assertUniqueKeys(snapshot.studySessions.map((row) => row.id))
  assertUniqueKeys(snapshot.goals.map((row) => row.id))
  assertUniqueKeys(snapshot.settings.map((row) => row.key))
}

function assertSubjectReference(subjectId: string, subjectIds: ReadonlySet<string>): void {
  if (subjectId === '') return
  if (!subjectIds.has(subjectId)) {
    throw new Error(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
  }
}

/**
 * Rejects non-empty `subjectId` values that are not present in the imported subjects table.
 * Empty string remains valid (General / unassigned). Call after uniqueness checks, before any IDB write.
 *
 * For `activeFocusSession`, only structurally valid values (via `isActiveFocusSession`) are
 * relationship-checked here; malformed focus payloads are rejected by settings-value validation.
 */
export function assertStudyExportSubjectReferences(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'settings'
  >,
): void {
  const subjectIds = new Set(snapshot.subjects.map((subject) => subject.id))

  for (const row of snapshot.tasks) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.notes) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.events) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.flashcards) {
    assertSubjectReference(row.subjectId, subjectIds)
  }
  for (const row of snapshot.studySessions) {
    assertSubjectReference(row.subjectId, subjectIds)
  }

  for (const setting of snapshot.settings) {
    if (setting.key !== ACTIVE_FOCUS_SESSION_KEY) continue
    if (!isActiveFocusSession(setting.value)) continue
    assertSubjectReference(setting.value.subjectId, subjectIds)
  }
}

function failValidation(): never {
  throw new Error(STUDY_EXPORT_IMPORT_VALIDATION_ERROR)
}

function assertTimestampOrder(startIso: string, endIso: string): void {
  if (Date.parse(endIso) < Date.parse(startIso)) {
    failValidation()
  }
}

/**
 * Rejects integrity-level semantic violations (ranges, non-positive durations, temporal order).
 * Does not enforce UI maximums or future-ended session policy. Call after uniqueness and
 * subject-reference checks, before any IDB write.
 */
export function assertStudyExportSemantics(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'goals'
  >,
): void {
  for (const subject of snapshot.subjects) {
    if (subject.progress < 0 || subject.progress > 100) failValidation()
    if (subject.targetHours <= 0) failValidation()
  }

  for (const task of snapshot.tasks) {
    if (task.minutes < 0) failValidation()
  }

  for (const session of snapshot.studySessions) {
    if (session.minutes <= 0) failValidation()
    assertTimestampOrder(session.startedAt, session.endedAt)
  }

  for (const event of snapshot.events) {
    assertTimestampOrder(event.startAt, event.endAt)
  }

  for (const goal of snapshot.goals) {
    if (goal.target <= 0) failValidation()
    if (goal.progress < 0) failValidation()
  }

  for (const card of snapshot.flashcards) {
    if (card.intervalDays !== undefined && card.intervalDays < 0) failValidation()
    if (card.reviewCount !== undefined && card.reviewCount < 0) failValidation()
  }
}

const LEGACY_MIGRATION_SETTING_KEY = 'legacy-localstorage-migrated-v1'
const DAILY_GOAL_MINUTES_KEY = 'dailyGoalMinutes'
const QUICK_NOTES_KEY = 'quickNotes'
const DAILY_GOAL_MINUTES_MIN = 30
const DAILY_GOAL_MINUTES_MAX = 720
const QUICK_NOTES_MAX = 8

/**
 * Validates known settings value contracts. Unknown keys are accepted unchanged.
 * Call after uniqueness checks (and preferably after other structural validators), before any IDB write.
 */
export function assertStudyExportSettingsValues(
  snapshot: Pick<StudyExport, 'settings'>,
): void {
  for (const setting of snapshot.settings) {
    switch (setting.key) {
      case DAILY_GOAL_MINUTES_KEY: {
        const value = setting.value
        if (typeof value !== 'number' || !Number.isFinite(value)) failValidation()
        if (value < DAILY_GOAL_MINUTES_MIN || value > DAILY_GOAL_MINUTES_MAX) failValidation()
        break
      }
      case QUICK_NOTES_KEY: {
        const value = setting.value
        if (!Array.isArray(value) || value.length > QUICK_NOTES_MAX) failValidation()
        if (!value.every((entry) => typeof entry === 'string')) failValidation()
        break
      }
      case LEGACY_MIGRATION_SETTING_KEY: {
        if (setting.value !== true) failValidation()
        break
      }
      case ACTIVE_FOCUS_SESSION_KEY: {
        if (!isActiveFocusSession(setting.value)) failValidation()
        break
      }
      default:
        break
    }
  }
}
