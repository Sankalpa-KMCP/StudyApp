import { describe, expect, it } from 'vitest'
import {
  assertProspectiveBackupability,
  assertProspectiveRecordCounts,
  DatabaseBackupabilityLimitError,
  serializeCanonicalBackup,
} from './backupabilityGuard'
import {
  MAX_STUDY_EXPORT_IMPORT_BYTES,
  MAX_STUDY_EXPORT_IMPORT_CHARS,
  STUDY_EXPORT_RECORD_LIMITS,
} from './studyExportLimits'
import {
  createStudyExportPayload,
  exportStudyData,
  importStudyData,
  type StudyData,
} from './studyDb'
import type { StudyNote, StudySubject, StudyTask } from './types'

function createEmptyStudyData(): StudyData {
  return {
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    studySessions: [],
    goals: [],
    settings: [],
  }
}

describe('backupabilityGuard', () => {
  describe('canonical serialization and exact UTF-8 byte measurement', () => {
    it('measures exact UTF-8 byte length across ASCII, multi-byte Unicode, emojis, and escaped characters', () => {
      const complexText = 'Hello World! 🚀 日本語テスト \n\t "quoted" \\backslash\\ \u00A9 \u20AC \u{1F4DA}'
      const note: StudyNote = {
        id: 'note-1',
        title: 'Title with 🌟 and "quotes"',
        body: complexText,
        subjectId: '',
        tags: ['unicode-テスト', 'tag-"2"'],
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z',
      }

      const data: StudyData = {
        ...createEmptyStudyData(),
        notes: [note],
      }

      const { payload, serialized, byteLength } = serializeCanonicalBackup(data, {
        exportedAt: '2026-08-29T12:00:00.000Z',
        appVersion: '1.4.0',
      })

      expect(payload.version).toBe(4)
      expect(payload.notes).toHaveLength(1)

      const expectedJson = JSON.stringify(payload, null, 2)
      expect(serialized).toBe(expectedJson)

      const expectedBytes = new TextEncoder().encode(serialized).byteLength
      expect(byteLength).toBe(expectedBytes)
      // Multi-byte Unicode characters mean byteLength is strictly greater than string character length
      expect(byteLength).toBeGreaterThan(serialized.length)
    })
  })

  describe('assertProspectiveRecordCounts', () => {
    it('allows record counts within standard limits', () => {
      const data: StudyData = {
        ...createEmptyStudyData(),
        subjects: [{ id: 's1', name: 'Math', color: '#111827', targetHours: 10, progress: 0, progressMode: 'manual', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' }],
      }
      expect(() => assertProspectiveRecordCounts(data)).not.toThrow()
    })

    it('rejects prospective record counts exceeding per-table limit', () => {
      const dummySubject: StudySubject = { id: 's', name: 'Subj', color: '#111827', targetHours: 1, progress: 0, progressMode: 'manual', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' }
      const customLimits = {
        ...STUDY_EXPORT_RECORD_LIMITS,
        subjects: 2,
      }

      const data: StudyData = {
        ...createEmptyStudyData(),
        subjects: [dummySubject, { ...dummySubject, id: 's2' }, { ...dummySubject, id: 's3' }],
      }

      expect(() => assertProspectiveRecordCounts(data, undefined, customLimits)).toThrow(
        DatabaseBackupabilityLimitError
      )
    })

    it('rejects prospective record counts exceeding total limit', () => {
      const dummySubject: StudySubject = { id: 's', name: 'Subj', color: '#111827', targetHours: 1, progress: 0, progressMode: 'manual', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' }
      const customLimits = {
        ...STUDY_EXPORT_RECORD_LIMITS,
        total: 2,
        subjects: 5,
      }

      const data: StudyData = {
        ...createEmptyStudyData(),
        subjects: [dummySubject, { ...dummySubject, id: 's2' }, { ...dummySubject, id: 's3' }],
      }

      expect(() => assertProspectiveRecordCounts(data, undefined, customLimits)).toThrow(
        DatabaseBackupabilityLimitError
      )
    })

    it('permits non-worsening reduction or equality for grandfathered count-oversized states', () => {
      const customLimits = {
        ...STUDY_EXPORT_RECORD_LIMITS,
        tasks: 2,
      }

      const currentTasks: StudyTask[] = [
        { id: 't1', title: 'T1', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 10, createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
        { id: 't2', title: 'T2', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 10, createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
        { id: 't3', title: 'T3', subjectId: '', dueDate: '2026-09-01', priority: 'normal', status: 'open', minutes: 10, createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
      ]

      const current: StudyData = {
        ...createEmptyStudyData(),
        tasks: currentTasks,
      }

      // 1. Reduced count (3 -> 2): allowed
      const prospectiveReduced: StudyData = {
        ...createEmptyStudyData(),
        tasks: currentTasks.slice(0, 2),
      }
      expect(() => assertProspectiveRecordCounts(prospectiveReduced, current, customLimits)).not.toThrow()

      // 2. Same count edit (3 -> 3): allowed
      const prospectiveSame: StudyData = {
        ...createEmptyStudyData(),
        tasks: [{ ...currentTasks[0], title: 'Updated T1' }, currentTasks[1], currentTasks[2]],
      }
      expect(() => assertProspectiveRecordCounts(prospectiveSame, current, customLimits)).not.toThrow()

      // 3. Increased count (3 -> 4): rejected
      const prospectiveIncreased: StudyData = {
        ...createEmptyStudyData(),
        tasks: [...currentTasks, { ...currentTasks[0], id: 't4' }],
      }
      expect(() => assertProspectiveRecordCounts(prospectiveIncreased, current, customLimits)).toThrow(
        DatabaseBackupabilityLimitError
      )
    })
  })

  describe('assertProspectiveBackupability byte boundaries and grandfathering', () => {
    it('accepts a state whose canonical serialized size is strictly within configured byte limit', () => {
      const data = createEmptyStudyData()
      const result = assertProspectiveBackupability(data)
      expect(result.prospectiveBytes).toBeLessThanOrEqual(MAX_STUDY_EXPORT_IMPORT_BYTES)
    })

    it('rejects a state exceeding the configured byte ceiling when starting from standard state', () => {
      const smallLimit = 500
      const largeNote: StudyNote = {
        id: 'n1',
        title: 'Large Note',
        body: 'X'.repeat(600),
        subjectId: '',
        tags: [],
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z',
      }

      const prospective: StudyData = {
        ...createEmptyStudyData(),
        notes: [largeNote],
      }

      expect(() =>
        assertProspectiveBackupability(prospective, createEmptyStudyData(), {
          maxBytes: smallLimit,
          recordLimits: STUDY_EXPORT_RECORD_LIMITS,
        })
      ).toThrow(DatabaseBackupabilityLimitError)
    })

    it('permits non-worsening reduction of an already byte-oversized database', () => {
      const smallLimit = 400
      const oversizedNoteCurrent: StudyNote = {
        id: 'n1',
        title: 'Oversized Note',
        body: 'A'.repeat(500),
        subjectId: '',
        tags: [],
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z',
      }

      const current: StudyData = {
        ...createEmptyStudyData(),
        notes: [oversizedNoteCurrent],
      }

      // Prospective has shorter body (500 -> 450 chars): bytes reduced -> permitted!
      const prospectiveReduced: StudyData = {
        ...createEmptyStudyData(),
        notes: [{ ...oversizedNoteCurrent, body: 'A'.repeat(450) }],
      }

      expect(() =>
        assertProspectiveBackupability(prospectiveReduced, current, {
          maxBytes: smallLimit,
          recordLimits: STUDY_EXPORT_RECORD_LIMITS,
        })
      ).not.toThrow()

      // Prospective has longer body (500 -> 550 chars): bytes increased -> rejected!
      const prospectiveIncreased: StudyData = {
        ...createEmptyStudyData(),
        notes: [{ ...oversizedNoteCurrent, body: 'A'.repeat(550) }],
      }

      expect(() =>
        assertProspectiveBackupability(prospectiveIncreased, current, {
          maxBytes: smallLimit,
          recordLimits: STUDY_EXPORT_RECORD_LIMITS,
        })
      ).toThrow(DatabaseBackupabilityLimitError)
    })
  })

  describe('F-02 Resolution: >5 MiB Valid Workspace Backup and Restore', () => {
    it('successfully validates, exports, and imports a ~5.5 MiB valid workspace under the 64 MiB limit', async () => {
      // 5.5 MiB text payload
      const largeBody = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100_000)
      const note: StudyNote = {
        id: 'big-note-1',
        title: 'Comprehensive 5.5MB Study Guide 📚',
        body: largeBody,
        subjectId: '',
        tags: ['biology', 'final-exam'],
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z',
      }

      const subject: StudySubject = {
        id: 'subj-1',
        name: 'Advanced Cellular Biology',
        color: '#2563eb',
        targetHours: 40,
        progress: 25,
        progressMode: 'manual',
        createdAt: '2026-08-29T12:00:00.000Z',
        updatedAt: '2026-08-29T12:00:00.000Z',
      }

      const snapshot: StudyData = {
        ...createEmptyStudyData(),
        subjects: [subject],
        notes: [note],
      }

      // 1. Prospective guard validates under the 64 MiB ceiling
      const guardResult = assertProspectiveBackupability(snapshot)
      expect(guardResult.prospectiveBytes).toBeGreaterThan(5 * 1024 * 1024)
      expect(guardResult.prospectiveBytes).toBeLessThanOrEqual(MAX_STUDY_EXPORT_IMPORT_BYTES)

      // 2. Canonical serialization produces V4 export
      const payload = createStudyExportPayload(snapshot)
      expect(payload.version).toBe(4)
      const serialized = JSON.stringify(payload, null, 2)
      expect(serialized.length).toBeGreaterThan(5 * 1024 * 1024)
      expect(serialized.length).toBeLessThanOrEqual(MAX_STUDY_EXPORT_IMPORT_CHARS)

      // 3. Import pipeline parses and restores the >5 MiB data with 100% exact fidelity
      await importStudyData(serialized)
      const restored = await exportStudyData()
      expect(restored.subjects).toHaveLength(1)
      expect(restored.subjects[0].name).toBe('Advanced Cellular Biology')
      expect(restored.notes).toHaveLength(1)
      expect(restored.notes[0].title).toBe('Comprehensive 5.5MB Study Guide 📚')
      expect(restored.notes[0].body).toBe(largeBody)
    })
  })
})
