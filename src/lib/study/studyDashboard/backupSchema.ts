import type { CategoryItem, DailyLog, FlashcardItem, HistoryEntry, QuickNoteItem, SettingsRow, TaskItem } from '../../../db/types'
import { parseLegacyHistoryTimestamp } from './dateTime'
import type { ParsedStudyBackupPayload, StudyBackupInput } from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function parseStudyBackupPayload(raw: string): ParsedStudyBackupPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const payload = parsed as StudyBackupInput
    const quickNotes = toArray<QuickNoteItem>(payload.quickNotes ?? payload.quick_notes)

    return {
      rawVersion: payload.version,
      version: Number.isFinite(Number(payload.version)) ? Number(payload.version) : 1,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
      tasks: toArray<TaskItem>(payload.tasks),
      history: toArray<HistoryEntry>(payload.history).map(h => ({
        ...h,
        createdAt: h.createdAt ?? parseLegacyHistoryTimestamp(h.timestamp),
      })),
      dailyLogs: toArray<DailyLog>(payload.dailyLogs),
      settings: toArray<SettingsRow>(payload.settings),
      categories: toArray<CategoryItem>(payload.categories),
      flashcards: toArray<FlashcardItem>(payload.flashcards),
      quickNotes,
      checksumSha256: typeof payload.checksumSha256 === 'string' ? payload.checksumSha256 : undefined,
    }
  } catch {
    return null
  }
}

export function validateBackupPayload(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false
  }

  const p = parsed as Record<string, unknown>

  if ('version' in p && typeof p.version !== 'number') {
    return false
  }

  if ('tasks' in p) {
    if (!Array.isArray(p.tasks)) return false
    for (const t of p.tasks) {
      if (typeof t !== 'object' || t === null) return false
      if (typeof t.text !== 'string' || typeof t.completed !== 'boolean') return false
    }
  }

  if ('history' in p) {
    if (!Array.isArray(p.history)) return false
    for (const h of p.history) {
      if (typeof h !== 'object' || h === null) return false
      if (typeof h.timestamp !== 'string' || !['study', 'break'].includes(h.type) || typeof h.durationMinutes !== 'number') return false
      if ('createdAt' in h && h.createdAt !== undefined && typeof h.createdAt !== 'number') return false
    }
  }

  if ('dailyLogs' in p) {
    if (!Array.isArray(p.dailyLogs)) return false
    for (const l of p.dailyLogs) {
      if (typeof l !== 'object' || l === null) return false
      if (typeof l.dateString !== 'string' || typeof l.studyMinutes !== 'number' || typeof l.breakMinutes !== 'number') return false
    }
  }

  if ('settings' in p) {
    if (!Array.isArray(p.settings)) return false
    for (const s of p.settings) {
      if (typeof s !== 'object' || s === null) return false
      if (typeof s.key !== 'string' || !('value' in s)) return false
    }
  }

  if ('categories' in p) {
    if (!Array.isArray(p.categories)) return false
    for (const c of p.categories) {
      if (typeof c !== 'object' || c === null) return false
      if (typeof c.name !== 'string' || typeof c.color !== 'string') return false
    }
  }

  if ('flashcards' in p) {
    if (!Array.isArray(p.flashcards)) return false
    for (const f of p.flashcards) {
      if (typeof f !== 'object' || f === null) return false
      if (typeof f.question !== 'string' || typeof f.answer !== 'string') return false
    }
  }

  if ('quickNotes' in p || 'quick_notes' in p) {
    const notes = p.quickNotes ?? p.quick_notes
    if (!Array.isArray(notes)) return false
    for (const n of notes) {
      if (typeof n !== 'object' || n === null) return false
      if (typeof n.title !== 'string' || typeof n.content !== 'string') return false
    }
  }

  return true
}
