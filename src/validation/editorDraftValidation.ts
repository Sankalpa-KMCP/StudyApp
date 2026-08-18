import { parseLocalDateTime, parseTags } from '../appUtils'
import { isSubjectProgressMode, type SubjectProgressMode } from '../db/types'
import {
  CALENDAR_EDITOR_DURATION_MIN,
  clampSubjectEditorProgress,
  clampSubjectEditorTargetHours,
  STUDY_SESSION_EDITOR_DURATION_MIN,
} from './editorLimits'

/**
 * Message-neutral create/edit draft checks for Subjects, Notes, Flashcards,
 * Calendar events, and manual Progress study sessions.
 * Views own user-facing copy, accessibility, mutation state, and persistence.
 */

export type SubjectEditorDraftInput = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: unknown
}

export type SubjectEditorFields = {
  name: string
  color: string
  targetHours: number
  progress: number
  progressMode: SubjectProgressMode
}

export type SubjectEditorDraftValidation =
  | { ok: true; fields: SubjectEditorFields }
  | { ok: false; reason: 'empty_name' | 'invalid_progress_mode' }

export function validateSubjectEditorDraft(
  draft: SubjectEditorDraftInput,
): SubjectEditorDraftValidation {
  const name = draft.name.trim()
  if (!name) {
    return { ok: false, reason: 'empty_name' }
  }

  if (!isSubjectProgressMode(draft.progressMode)) {
    return { ok: false, reason: 'invalid_progress_mode' }
  }

  return {
    ok: true,
    fields: {
      name,
      color: draft.color,
      targetHours: clampSubjectEditorTargetHours(draft.targetHours),
      progress: clampSubjectEditorProgress(draft.progress),
      progressMode: draft.progressMode,
    },
  }
}

export type NoteEditorDraftInput = {
  title: string
  body: string
  subjectId: string
  tags: string
}

export type NoteEditorFields = {
  title: string
  body: string
  subjectId: string
  tags: string[]
}

export type NoteEditorDraftValidation =
  | { ok: true; fields: NoteEditorFields }
  | { ok: false; reason: 'empty_title' }

export function validateNoteEditorDraft(draft: NoteEditorDraftInput): NoteEditorDraftValidation {
  const title = draft.title.trim()
  if (!title) {
    return { ok: false, reason: 'empty_title' }
  }

  return {
    ok: true,
    fields: {
      title,
      body: draft.body.trim(),
      subjectId: draft.subjectId,
      tags: parseTags(draft.tags),
    },
  }
}

export type FlashcardEditorDraftInput = {
  front: string
  back: string
  subjectId: string
}

export type FlashcardEditorFields = {
  front: string
  back: string
  subjectId: string
}

export type FlashcardEditorDraftValidation =
  | { ok: true; fields: FlashcardEditorFields }
  | { ok: false; reason: 'empty_sides' }

export function validateFlashcardEditorDraft(
  draft: FlashcardEditorDraftInput,
): FlashcardEditorDraftValidation {
  const front = draft.front.trim()
  const back = draft.back.trim()
  if (!front || !back) {
    return { ok: false, reason: 'empty_sides' }
  }

  return {
    ok: true,
    fields: {
      front,
      back,
      subjectId: draft.subjectId,
    },
  }
}

export type CalendarEventEditorDraftInput = {
  title: string
  subjectId: string
  date: string
  time: string
  duration: number
  location: string
}

export type CalendarEventEditorFields = {
  title: string
  subjectId: string
  startAt: string
  endAt: string
  location: string
}

export type CalendarEventEditorDraftValidation =
  | { ok: true; fields: CalendarEventEditorFields }
  | { ok: false; reason: 'empty_title' | 'invalid_start' | 'invalid_duration' }

export function validateCalendarEventEditorDraft(
  draft: CalendarEventEditorDraftInput,
): CalendarEventEditorDraftValidation {
  const title = draft.title.trim()
  if (!title) {
    return { ok: false, reason: 'empty_title' }
  }

  const startedAt = parseLocalDateTime(draft.date, draft.time)
  if (!startedAt) {
    return { ok: false, reason: 'invalid_start' }
  }

  if (!Number.isFinite(draft.duration) || draft.duration < CALENDAR_EDITOR_DURATION_MIN) {
    return { ok: false, reason: 'invalid_duration' }
  }

  return {
    ok: true,
    fields: {
      title,
      subjectId: draft.subjectId,
      startAt: startedAt.toISOString(),
      endAt: new Date(startedAt.getTime() + draft.duration * 60_000).toISOString(),
      location: draft.location.trim(),
    },
  }
}

export type StudySessionEditorDraftInput = {
  subjectId: string
  date: string
  time: string
  duration: string
  note: string
  /** True when `subjectId` is non-empty and absent from the available subject map. */
  subjectMissing: boolean
  /** Wall-clock reference for the future-end check; defaults to `Date.now()`. */
  nowMs?: number
}

export type StudySessionEditorFields = {
  subjectId: string
  startedAt: string
  endedAt: string
  minutes: number
  note: string
}

export type StudySessionEditorDraftValidation =
  | { ok: true; fields: StudySessionEditorFields }
  | {
      ok: false
      reason: 'missing_subject' | 'invalid_start' | 'invalid_duration' | 'future_end'
    }

export function validateStudySessionEditorDraft(
  draft: StudySessionEditorDraftInput,
): StudySessionEditorDraftValidation {
  if (draft.subjectMissing) {
    return { ok: false, reason: 'missing_subject' }
  }

  const startedAt = parseLocalDateTime(draft.date, draft.time)
  if (!startedAt) {
    return { ok: false, reason: 'invalid_start' }
  }

  const minutes = Number(draft.duration)
  if (!Number.isInteger(minutes) || minutes < STUDY_SESSION_EDITOR_DURATION_MIN) {
    return { ok: false, reason: 'invalid_duration' }
  }

  const endedAt = new Date(startedAt.getTime() + minutes * 60_000)
  const nowMs = draft.nowMs ?? Date.now()
  if (endedAt.getTime() > nowMs) {
    return { ok: false, reason: 'future_end' }
  }

  return {
    ok: true,
    fields: {
      subjectId: draft.subjectId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      minutes,
      note: draft.note.trim(),
    },
  }
}
