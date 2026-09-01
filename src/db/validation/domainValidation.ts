import type {
  GoalPeriod,
  TaskPriority,
  TaskStatus,
} from '../types'
import { isGoalMetric, isSubjectProgressMode } from '../types'
import {
  isNonBlankString,
  isPersistedDueDate,
  isPersistedGoalProgress,
  isPersistedGoalTarget,
  isPersistedIsoTimestamp,
  isPersistedStudySessionMinutes,
  isPersistedSubjectProgress,
  isPersistedSubjectTargetHours,
  isPersistedTaskMinutes,
  isPersistedTimestampOrder,
} from './persistedInvariants'
import {
  InvalidSubjectColorError,
  isValidSubjectColor,
} from '../../validation/subjectColor'
import type { SubjectWriteFields } from '../subjectService'
import type { TaskWriteFields } from '../taskService'
import type { NoteWriteFields } from '../notesService'
import type { CalendarEventWriteFields } from '../calendarEventService'
import type { GoalWriteFields } from '../goalService'
import type { StudySessionWriteFields } from '../studySessionService'

/**
 * Distinguishable domain error thrown when a service mutation receives invalid field values.
 */
export class DomainValidationError extends Error {
  readonly code = 'invalid_domain_record' as const
  readonly field: string

  constructor(field: string, message = `Invalid domain field: ${field}`) {
    super(message)
    this.name = 'DomainValidationError'
    this.field = field
  }
}

/**
 * Type guard to identify DomainValidationError instances.
 */
export function isDomainValidationError(error: unknown): error is DomainValidationError {
  return (
    error instanceof DomainValidationError ||
    (Boolean(error) &&
      typeof error === 'object' &&
      (error as { code?: string }).code === 'invalid_domain_record')
  )
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return value === 'low' || value === 'normal' || value === 'high'
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'open' || value === 'done'
}

export function isGoalPeriod(value: unknown): value is GoalPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

export function assertSubjectWriteFields(fields: SubjectWriteFields): void {
  if (!isNonBlankString(fields.name)) {
    throw new DomainValidationError('name', 'Subject name must be a non-blank string.')
  }
  if (!isValidSubjectColor(fields.color)) {
    throw new InvalidSubjectColorError(fields.color)
  }
  if (!isPersistedSubjectTargetHours(fields.targetHours) || !Number.isFinite(fields.targetHours)) {
    throw new DomainValidationError('targetHours', 'Subject target hours must be a positive finite number.')
  }
  if (!isPersistedSubjectProgress(fields.progress) || !Number.isFinite(fields.progress)) {
    throw new DomainValidationError('progress', 'Subject progress must be a finite number between 0 and 100.')
  }
  if (!isSubjectProgressMode(fields.progressMode)) {
    throw new DomainValidationError('progressMode', 'Invalid subject progress mode.')
  }
}

export function assertTaskWriteFields(fields: TaskWriteFields): void {
  if (!isNonBlankString(fields.title)) {
    throw new DomainValidationError('title', 'Task title must be a non-blank string.')
  }
  if (typeof fields.subjectId !== 'string') {
    throw new DomainValidationError('subjectId', 'Task subjectId must be a string.')
  }
  if (!isPersistedDueDate(fields.dueDate)) {
    throw new DomainValidationError('dueDate', 'Task dueDate must be empty or a valid YYYY-MM-DD date key.')
  }
  if (!isTaskPriority(fields.priority)) {
    throw new DomainValidationError('priority', 'Invalid task priority.')
  }
  if (!isPersistedTaskMinutes(fields.minutes) || !Number.isFinite(fields.minutes)) {
    throw new DomainValidationError('minutes', 'Task minutes must be a non-negative finite number.')
  }
}

export function assertTaskStatus(status: TaskStatus): void {
  if (!isTaskStatus(status)) {
    throw new DomainValidationError('status', 'Invalid task status.')
  }
}

export function assertNoteWriteFields(fields: NoteWriteFields): void {
  if (!isNonBlankString(fields.title)) {
    throw new DomainValidationError('title', 'Note title must be a non-blank string.')
  }
  if (typeof fields.body !== 'string') {
    throw new DomainValidationError('body', 'Note body must be a string.')
  }
  if (typeof fields.subjectId !== 'string') {
    throw new DomainValidationError('subjectId', 'Note subjectId must be a string.')
  }
  if (!Array.isArray(fields.tags) || !fields.tags.every((tag) => typeof tag === 'string')) {
    throw new DomainValidationError('tags', 'Note tags must be an array of strings.')
  }
}

export function assertCalendarEventWriteFields(fields: CalendarEventWriteFields): void {
  if (!isNonBlankString(fields.title)) {
    throw new DomainValidationError('title', 'Event title must be a non-blank string.')
  }
  if (typeof fields.subjectId !== 'string') {
    throw new DomainValidationError('subjectId', 'Event subjectId must be a string.')
  }
  if (!isPersistedIsoTimestamp(fields.startAt)) {
    throw new DomainValidationError('startAt', 'Event startAt must be a valid ISO-8601 UTC timestamp.')
  }
  if (!isPersistedIsoTimestamp(fields.endAt)) {
    throw new DomainValidationError('endAt', 'Event endAt must be a valid ISO-8601 UTC timestamp.')
  }
  if (!isPersistedTimestampOrder(fields.startAt, fields.endAt)) {
    throw new DomainValidationError('endAt', 'Event endAt must not be earlier than startAt.')
  }
  if (typeof fields.location !== 'string') {
    throw new DomainValidationError('location', 'Event location must be a string.')
  }
}

export function assertGoalWriteFields(fields: GoalWriteFields): void {
  if (!isNonBlankString(fields.title)) {
    throw new DomainValidationError('title', 'Goal title must be a non-blank string.')
  }
  if (!isPersistedGoalTarget(fields.target) || !Number.isFinite(fields.target)) {
    throw new DomainValidationError('target', 'Goal target must be a positive finite number.')
  }
  if (!isPersistedGoalProgress(fields.progress) || !Number.isFinite(fields.progress)) {
    throw new DomainValidationError('progress', 'Goal progress must be a non-negative finite number.')
  }
  if (!isGoalPeriod(fields.period)) {
    throw new DomainValidationError('period', 'Invalid goal period.')
  }
  if (!isGoalMetric(fields.metric)) {
    throw new DomainValidationError('metric', 'Invalid goal metric.')
  }
}

export function assertStudySessionWriteFields(fields: StudySessionWriteFields): void {
  if (typeof fields.subjectId !== 'string') {
    throw new DomainValidationError('subjectId', 'Session subjectId must be a string.')
  }
  if (!isPersistedIsoTimestamp(fields.startedAt)) {
    throw new DomainValidationError('startedAt', 'Session startedAt must be a valid ISO-8601 UTC timestamp.')
  }
  if (!isPersistedIsoTimestamp(fields.endedAt)) {
    throw new DomainValidationError('endedAt', 'Session endedAt must be a valid ISO-8601 UTC timestamp.')
  }
  if (!isPersistedTimestampOrder(fields.startedAt, fields.endedAt)) {
    throw new DomainValidationError('endedAt', 'Session endedAt must not be earlier than startedAt.')
  }
  if (!isPersistedStudySessionMinutes(fields.minutes) || !Number.isFinite(fields.minutes)) {
    throw new DomainValidationError('minutes', 'Session minutes must be a positive finite number.')
  }
  if (typeof fields.note !== 'string') {
    throw new DomainValidationError('note', 'Session note must be a string.')
  }
}
