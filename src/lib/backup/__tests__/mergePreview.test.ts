import { describe, it, expect } from 'vitest'
import { computeMergePreview } from '../mergePreview'
import type { ExportedTables } from '../../../db/repositories/database'

const emptyLocal: ExportedTables = {
  tasks: [],
  history: [],
  dailyLogs: [],
  settings: [],
  categories: [],
  quickNotes: [],
}

describe('computeMergePreview', () => {
  it('counts tasks added and updated', () => {
    const local: ExportedTables = {
      ...emptyLocal,
      tasks: [
        { id: 1, text: 'Local task', completed: false, createdAt: 1, estimatedCycles: 1, actualCycles: 0 },
      ],
    }
    const preview = computeMergePreview(local, {
      version: 4,
      exportedAt: '2026-06-12T12:00:00.000Z',
      tasks: [
        { id: 1, text: 'Updated', completed: true, createdAt: 1, estimatedCycles: 1, actualCycles: 1 },
        { id: 2, text: 'New remote', completed: false, createdAt: 2, estimatedCycles: 1, actualCycles: 0 },
      ],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })

    expect(preview.tasksAdded).toBe(1)
    expect(preview.tasksUpdated).toBe(1)
  })

  it('counts history entries to append by dedupe key', () => {
    const local: ExportedTables = {
      ...emptyLocal,
      history: [
        { createdAt: 100, type: 'study', durationMinutes: 25, timestamp: '2026-06-12T10:00:00.000Z' },
      ],
    }
    const preview = computeMergePreview(local, {
      version: 4,
      exportedAt: '2026-06-12T12:00:00.000Z',
      tasks: [],
      history: [
        { createdAt: 100, type: 'study', durationMinutes: 25, timestamp: '2026-06-12T10:00:00.000Z' },
        { createdAt: 200, type: 'break', durationMinutes: 5, timestamp: '2026-06-12T10:30:00.000Z' },
      ],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })

    expect(preview.historyToAppend).toBe(1)
  })

  it('counts settings from remote excluding flashcardsEnabled and existing keys', () => {
    const local: ExportedTables = {
      ...emptyLocal,
      settings: [{ key: 'theme', value: 'midnight-slate' }],
    }
    const preview = computeMergePreview(local, {
      version: 4,
      exportedAt: '2026-06-12T12:00:00.000Z',
      tasks: [],
      history: [],
      dailyLogs: [],
      settings: [
        { key: 'theme', value: 'ocean' },
        { key: 'flashcardsEnabled' as never, value: true },
        { key: 'historyRetentionDays', value: 30 },
      ],
      categories: [],
      quickNotes: [],
    })

    expect(preview.settingsFromRemote).toBe(1)
  })

  it('counts daily log deltas for overlapping dates', () => {
    const local: ExportedTables = {
      ...emptyLocal,
      dailyLogs: [{ dateString: '2026-06-10', studyMinutes: 30, breakMinutes: 5 }],
    }
    const preview = computeMergePreview(local, {
      version: 4,
      exportedAt: '2026-06-12T12:00:00.000Z',
      tasks: [],
      history: [],
      dailyLogs: [
        { dateString: '2026-06-10', studyMinutes: 20, breakMinutes: 0 },
        { dateString: '2026-06-11', studyMinutes: 10, breakMinutes: 0 },
      ],
      settings: [],
      categories: [],
      quickNotes: [],
    })

    expect(preview.dailyLogDeltas).toBe(1)
  })

  it('counts categories remapped by name and color', () => {
    const local: ExportedTables = {
      ...emptyLocal,
      categories: [{ id: 5, name: 'Math', color: '#8B5CF6' }],
    }
    const preview = computeMergePreview(local, {
      version: 4,
      exportedAt: '2026-06-12T12:00:00.000Z',
      tasks: [],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [
        { id: 99, name: 'Math', color: '#8B5CF6' },
        { id: 100, name: 'Science', color: '#3B82F6' },
      ],
      quickNotes: [],
    })

    expect(preview.categoriesRemapped).toBe(1)
  })
})
