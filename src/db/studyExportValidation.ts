import { ACTIVE_FOCUS_SESSION_KEY, isActiveFocusSession } from './activeFocusSession'
import {
  STUDY_EXPORT_RECORD_LIMITS,
  type StudyExportRecordCounts,
  type StudyExportRecordLimits,
} from './studyExportLimits'
import type { StudyExport } from './types'
import {
  isPersistedGoalProgress,
  isPersistedGoalTarget,
  isPersistedOptionalNonNegativeCounter,
  isPersistedStudySessionMinutes,
  isPersistedSubjectProgress,
  isPersistedSubjectReference,
  isPersistedSubjectTargetHours,
  isPersistedTaskMinutes,
  isPersistedTimestampOrder,
} from './validation/persistedInvariants'

/** Stable internal error; Settings maps import failures to a fixed friendly message. */
export const STUDY_EXPORT_IMPORT_VALIDATION_ERROR = 'Import file is not a Study Dashboard export.'

export type StudyExportValidationCode =
  | 'invalid_json'
  | 'invalid_structure'
  | 'future_version'
  | 'unsupported_old_version'
  | 'invalid_records'
  | 'transaction_failed'

export class StudyExportValidationError extends Error {
  readonly code: StudyExportValidationCode
  readonly details?: { encounteredVersion?: number }
  readonly encounteredVersion?: number

  constructor(
    code: StudyExportValidationCode,
    message: string = STUDY_EXPORT_IMPORT_VALIDATION_ERROR,
    options?: { encounteredVersion?: number }
  ) {
    super(message)
    this.name = 'StudyExportValidationError'
    this.code = code
    this.details = options
    this.encounteredVersion = options?.encounteredVersion
  }
}

function failValidation(
  code: StudyExportValidationCode = 'invalid_records',
  message: string = STUDY_EXPORT_IMPORT_VALIDATION_ERROR
): never {
  throw new StudyExportValidationError(code, message)
}

function assertUniqueKeys(keys: string[]): void {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      failValidation('invalid_records')
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
  if (!isPersistedSubjectReference(subjectId, subjectIds)) {
    failValidation('invalid_records')
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
    if (!isPersistedSubjectProgress(subject.progress)) failValidation()
    if (!isPersistedSubjectTargetHours(subject.targetHours)) failValidation()
  }

  for (const task of snapshot.tasks) {
    if (!isPersistedTaskMinutes(task.minutes)) failValidation()
  }

  for (const session of snapshot.studySessions) {
    if (!isPersistedStudySessionMinutes(session.minutes)) failValidation()
    if (!isPersistedTimestampOrder(session.startedAt, session.endedAt)) failValidation()
  }

  for (const event of snapshot.events) {
    if (!isPersistedTimestampOrder(event.startAt, event.endAt)) failValidation()
  }

  for (const goal of snapshot.goals) {
    if (!isPersistedGoalTarget(goal.target)) failValidation()
    if (!isPersistedGoalProgress(goal.progress)) failValidation()
  }

  for (const card of snapshot.flashcards) {
    if (!isPersistedOptionalNonNegativeCounter(card.intervalDays)) failValidation()
    if (!isPersistedOptionalNonNegativeCounter(card.reviewCount)) failValidation()
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

/**
 * Rejects imports that exceed total or per-table record-count ceilings.
 * `limits` defaults to production constants; tests may inject smaller ceilings.
 * Call after uniqueness, relationship, semantic, and settings-value checks.
 */
export function assertStudyExportRecordCounts(
  snapshot: Pick<
    StudyExport,
    'subjects' | 'tasks' | 'notes' | 'events' | 'flashcards' | 'studySessions' | 'goals' | 'settings'
  >,
  limits: StudyExportRecordLimits = STUDY_EXPORT_RECORD_LIMITS,
): void {
  assertStudyExportRecordCountTotals({
    subjects: snapshot.subjects.length,
    tasks: snapshot.tasks.length,
    notes: snapshot.notes.length,
    events: snapshot.events.length,
    flashcards: snapshot.flashcards.length,
    studySessions: snapshot.studySessions.length,
    goals: snapshot.goals.length,
    settings: snapshot.settings.length,
  }, limits)
}

/**
 * Length-based count gate used by {@link assertStudyExportRecordCounts}.
 * Exported so large production ceilings can be exercised without allocating huge arrays.
 */
export function assertStudyExportRecordCountTotals(
  counts: StudyExportRecordCounts,
  limits: StudyExportRecordLimits = STUDY_EXPORT_RECORD_LIMITS,
): void {
  if (counts.subjects > limits.subjects) failValidation()
  if (counts.tasks > limits.tasks) failValidation()
  if (counts.notes > limits.notes) failValidation()
  if (counts.events > limits.events) failValidation()
  if (counts.flashcards > limits.flashcards) failValidation()
  if (counts.studySessions > limits.studySessions) failValidation()
  if (counts.goals > limits.goals) failValidation()
  if (counts.settings > limits.settings) failValidation()

  const total = counts.subjects
    + counts.tasks
    + counts.notes
    + counts.events
    + counts.flashcards
    + counts.studySessions
    + counts.goals
    + counts.settings

  if (total > limits.total) failValidation()
}
