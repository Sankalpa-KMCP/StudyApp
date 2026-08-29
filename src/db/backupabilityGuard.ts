import {
  MAX_STUDY_EXPORT_IMPORT_BYTES,
  STUDY_EXPORT_RECORD_LIMITS,
  type StudyExportRecordCounts,
  type StudyExportRecordLimits,
} from './studyExportLimits'
import { createStudyExportPayload } from './studyDb'
import type { StudyData, StudyExport } from './types'

export class DatabaseBackupabilityLimitError extends Error {
  readonly code = 'backupability_limit'

  constructor(
    message = 'Database storage limit reached. Delete or reduce data before adding more content.'
  ) {
    super(message)
    this.name = 'DatabaseBackupabilityLimitError'
  }
}

export type BackupabilityLimits = {
  maxBytes: number
  recordLimits: StudyExportRecordLimits
}

export const DEFAULT_BACKUPABILITY_LIMITS: BackupabilityLimits = {
  maxBytes: MAX_STUDY_EXPORT_IMPORT_BYTES,
  recordLimits: STUDY_EXPORT_RECORD_LIMITS,
}

/**
 * Generates the canonical V4 export payload, formats with 2-space indentation,
 * and measures the exact UTF-8 byte length using the platform TextEncoder.
 */
export function serializeCanonicalBackup(
  snapshot: StudyData,
  options?: { exportedAt?: string; appVersion?: string }
): { payload: StudyExport; serialized: string; byteLength: number } {
  const payload = createStudyExportPayload(
    snapshot,
    options?.exportedAt,
    options?.appVersion
  )
  const serialized = JSON.stringify(payload, null, 2)
  const byteLength = new TextEncoder().encode(serialized).byteLength
  return { payload, serialized, byteLength }
}

/**
 * Evaluates record counts against standard ceilings or grandfathered non-worsening rules.
 *
 * Rules:
 * 1. If current count was within limit, prospective count must remain within limit.
 * 2. If current count already exceeded limit (grandfathered), prospective count cannot worsen (must be <= current count).
 * 3. Both per-table ceilings and the global 25,000 ceiling are strictly evaluated.
 */
export function assertProspectiveRecordCounts(
  prospective: StudyData,
  current?: StudyData,
  limits: StudyExportRecordLimits = STUDY_EXPORT_RECORD_LIMITS,
): void {
  const prospectiveCounts: StudyExportRecordCounts = {
    subjects: prospective.subjects.length,
    tasks: prospective.tasks.length,
    notes: prospective.notes.length,
    events: prospective.events.length,
    studySessions: prospective.studySessions.length,
    goals: prospective.goals.length,
    settings: prospective.settings.length,
  }

  const prospectiveTotal =
    prospectiveCounts.subjects +
    prospectiveCounts.tasks +
    prospectiveCounts.notes +
    prospectiveCounts.events +
    prospectiveCounts.studySessions +
    prospectiveCounts.goals +
    prospectiveCounts.settings

  if (!current) {
    if (prospectiveCounts.subjects > limits.subjects) {
      throw new DatabaseBackupabilityLimitError(`Record limit for subjects reached (${limits.subjects}).`)
    }
    if (prospectiveCounts.tasks > limits.tasks) {
      throw new DatabaseBackupabilityLimitError(`Record limit for tasks reached (${limits.tasks}).`)
    }
    if (prospectiveCounts.notes > limits.notes) {
      throw new DatabaseBackupabilityLimitError(`Record limit for notes reached (${limits.notes}).`)
    }
    if (prospectiveCounts.events > limits.events) {
      throw new DatabaseBackupabilityLimitError(`Record limit for events reached (${limits.events}).`)
    }
    if (prospectiveCounts.studySessions > limits.studySessions) {
      throw new DatabaseBackupabilityLimitError(`Record limit for studySessions reached (${limits.studySessions}).`)
    }
    if (prospectiveCounts.goals > limits.goals) {
      throw new DatabaseBackupabilityLimitError(`Record limit for goals reached (${limits.goals}).`)
    }
    if (prospectiveCounts.settings > limits.settings) {
      throw new DatabaseBackupabilityLimitError(`Record limit for settings reached (${limits.settings}).`)
    }
    if (prospectiveTotal > limits.total) {
      throw new DatabaseBackupabilityLimitError(`Total record limit reached (${limits.total}).`)
    }
    return
  }

  const currentCounts: StudyExportRecordCounts = {
    subjects: current.subjects.length,
    tasks: current.tasks.length,
    notes: current.notes.length,
    events: current.events.length,
    studySessions: current.studySessions.length,
    goals: current.goals.length,
    settings: current.settings.length,
  }

  const currentTotal =
    currentCounts.subjects +
    currentCounts.tasks +
    currentCounts.notes +
    currentCounts.events +
    currentCounts.studySessions +
    currentCounts.goals +
    currentCounts.settings

  const checkTable = (
    tableName: keyof StudyExportRecordCounts,
    pCount: number,
    cCount: number,
    limit: number
  ) => {
    if (cCount <= limit) {
      if (pCount > limit) {
        throw new DatabaseBackupabilityLimitError(
          `Record limit for ${tableName} reached (${limit}).`
        )
      }
    } else {
      if (pCount > cCount) {
        throw new DatabaseBackupabilityLimitError(
          `Record count for ${tableName} cannot be increased while exceeding limit.`
        )
      }
    }
  }

  checkTable('subjects', prospectiveCounts.subjects, currentCounts.subjects, limits.subjects)
  checkTable('tasks', prospectiveCounts.tasks, currentCounts.tasks, limits.tasks)
  checkTable('notes', prospectiveCounts.notes, currentCounts.notes, limits.notes)
  checkTable('events', prospectiveCounts.events, currentCounts.events, limits.events)
  checkTable('studySessions', prospectiveCounts.studySessions, currentCounts.studySessions, limits.studySessions)
  checkTable('goals', prospectiveCounts.goals, currentCounts.goals, limits.goals)
  checkTable('settings', prospectiveCounts.settings, currentCounts.settings, limits.settings)

  if (currentTotal <= limits.total) {
    if (prospectiveTotal > limits.total) {
      throw new DatabaseBackupabilityLimitError(
        `Total record limit reached (${limits.total}).`
      )
    }
  } else {
    if (prospectiveTotal > currentTotal) {
      throw new DatabaseBackupabilityLimitError(
        'Total record count cannot be increased while exceeding limit.'
      )
    }
  }
}

/**
 * Pure prospective backupability guard.
 *
 * Validates that the prospective state can produce a valid canonical standard backup.
 * If the current state was already oversized (byte-oversized or count-oversized),
 * allows mutations that reduce or do not worsen the violated constraints.
 */
export function assertProspectiveBackupability(
  prospective: StudyData,
  current?: StudyData,
  limits: BackupabilityLimits = DEFAULT_BACKUPABILITY_LIMITS,
): { prospectiveBytes: number; currentBytes?: number } {
  // 1. Evaluate record count ceilings
  assertProspectiveRecordCounts(prospective, current, limits.recordLimits)

  // 2. Canonical serialization with stable timestamp for deterministic comparison
  const fixedTimestamp = '2026-08-29T12:00:00.000Z'
  const { byteLength: prospectiveBytes } = serializeCanonicalBackup(prospective, {
    exportedAt: fixedTimestamp,
  })

  if (prospectiveBytes <= limits.maxBytes) {
    return { prospectiveBytes }
  }

  // If no current state is provided and prospective exceeds standard limit, reject
  if (!current) {
    throw new DatabaseBackupabilityLimitError(
      'Database storage limit (64 MiB) reached. Delete or reduce data before adding more content.'
    )
  }

  // When current state exists, check if current was already oversized
  const { byteLength: currentBytes } = serializeCanonicalBackup(current, {
    exportedAt: fixedTimestamp,
  })

  // If current was within limit, any transition over limit is rejected.
  // If current was already over limit, prospective must not worsen (must be <= currentBytes).
  if (currentBytes <= limits.maxBytes || prospectiveBytes > currentBytes) {
    throw new DatabaseBackupabilityLimitError(
      'Database storage limit (64 MiB) reached. Delete or reduce data before adding more content.'
    )
  }

  return { prospectiveBytes, currentBytes }
}
