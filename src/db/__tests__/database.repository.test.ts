import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase, seedTask } from '../../test/dbTestUtils'
import {
  clearAllTables,
  exportAllTables,
  mergeBackupData,
  replaceAllTables,
  resetSelective,
  getSchemaVersion,
} from '../repositories/database'

describe('database repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('exports all tables without flashcards', async () => {
    await seedTask('Export me')
    const tables = await exportAllTables()
    expect(tables.tasks).toHaveLength(1)
    expect('flashcards' in tables).toBe(false)
  })

  it('replaces all tables from backup payload', async () => {
    await seedTask('Old')
    await replaceAllTables({
      tasks: [{ text: 'New', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })
    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('New')
  })

  it('merges backup data and skips flashcardsEnabled setting', async () => {
    await db.settings.put({ key: 'theme', value: 'midnight-slate' })
    await mergeBackupData({
      tasks: [{ text: 'Merged', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }],
      history: [],
      dailyLogs: [{ dateString: '2026-06-10', studyMinutes: 10, breakMinutes: 0 }],
      settings: [
        { key: 'flashcardsEnabled' as never, value: true },
        { key: 'historyRetentionDays', value: 30 },
      ],
      categories: [],
      quickNotes: [],
    })
    expect(await db.tasks.count()).toBe(1)
    expect(await db.settings.get('flashcardsEnabled')).toBeUndefined()
    expect((await db.settings.get('historyRetentionDays'))?.value).toBe(30)
    expect((await db.daily_logs.get('2026-06-10'))?.studyMinutes).toBe(10)
  })

  it('resetSelective clears only chosen tables', async () => {
    await seedTask('Task')
    await db.quick_notes.add({ title: 'N', content: 'C', updatedAt: Date.now() })
    await resetSelective({ tasks: true, history: false, categories: false, notes: false })
    expect(await db.tasks.count()).toBe(0)
    expect(await db.quick_notes.count()).toBe(1)
  })

  it('clearAllTables empties core tables', async () => {
    await seedTask('Task')
    await clearAllTables()
    expect(await db.tasks.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)
  })

  it('resetDatabase seeds defaults after clear', async () => {
    await seedTask('Task')
    const { resetDatabase: resetDbRepo } = await import('../repositories/database')
    await resetDbRepo()
    expect(await db.tasks.count()).toBe(0)
    expect((await db.settings.get('dailyGoalMinutes'))?.value).toBe(120)
    expect(await db.categories.count()).toBeGreaterThan(0)
  })

  it('reports schema version 12 or higher', () => {
    expect(getSchemaVersion()).toBeGreaterThanOrEqual(12)
  })
})
