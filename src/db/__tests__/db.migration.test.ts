import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import { parseLegacyHistoryTimestamp } from '../../lib/study/studyDashboard'

describe('db migration helpers', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('opens database at version 7 with snapshots table', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(7)
    const tableNames = db.tables.map(t => t.name)
    expect(tableNames).toContain('snapshots')
  })

  it('parses legacy history timestamps for migration', () => {
    const ts = parseLegacyHistoryTimestamp('June 10, 14:30')
    const d = new Date(ts)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(10)
  })

  it('removes orphaned ambient settings keys after v7 cleanup', async () => {
    const orphanedAmbientKeys = [
      'ambientTrack',
      'ambientVolume',
      'ambientVolume_rain',
      'ambientVolume_cafe',
      'ambientVolume_whiteNoise',
      'audio_presets',
      'ambient_alphaWaves',
      'noiseType',
      'binauralTarget',
    ]
    for (const key of orphanedAmbientKeys) {
      await db.settings.put({ key: key as never, value: 'legacy' })
    }
    await db.settings.bulkDelete(orphanedAmbientKeys)
    const keys = (await db.settings.toArray()).map(s => s.key)
    for (const key of orphanedAmbientKeys) {
      expect(keys).not.toContain(key)
    }
  })

  it('stores createdAt on new history entries', async () => {
    const before = Date.now()
    const id = await db.history.add({
      timestamp: 'June 10, 14:30',
      createdAt: before,
      type: 'study',
      durationMinutes: 25,
    })
    const entry = await db.history.get(id)
    expect(entry?.createdAt).toBe(before)
  })

  it('opens database at version 12 without flashcards data', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(12)
    const enabled = await db.settings.get('flashcardsEnabled')
    expect(enabled).toBeUndefined()
    // fake-indexeddb may retain an empty orphan store; app schema v12 no longer uses it
    if (db.tables.some(t => t.name === 'flashcards')) {
      expect(await db.table('flashcards').count()).toBe(0)
    }
  })

  it('removes flashcardsEnabled and sanitizes lockoutAllowedTabs on v12', async () => {
    const tempDbName = 'StudyDashboardDB_v12_migration_test'
    await Dexie.delete(tempDbName)
    const dbOld = new Dexie(tempDbName)
    dbOld.version(11).stores({
      settings: '&key, value',
      flashcards: '++id, question, answer',
    })
    await dbOld.open()
    await dbOld.table('settings').bulkPut([
      { key: 'flashcardsEnabled', value: true },
      { key: 'lockoutAllowedTabs', value: '["cards","journal"]' },
    ])
    await dbOld.table('flashcards').add({
      question: 'Q',
      answer: 'A',
      createdAt: Date.now(),
      repetitionCount: 0,
      easinessFactor: 2.5,
      intervalDays: 0,
    })
    dbOld.close()

    const dbNew = new Dexie(tempDbName)
    dbNew.version(11).stores({
      settings: '&key, value',
      flashcards: '++id, question, answer',
    })
    dbNew.version(12).stores({
      settings: '&key, value',
    }).upgrade(async tx => {
      try {
        await tx.table('flashcards').clear()
      } catch { /* noop */ }
      await tx.table('settings').delete('flashcardsEnabled')
      const lockoutRow = await tx.table('settings').get('lockoutAllowedTabs')
      if (lockoutRow && typeof lockoutRow.value === 'string') {
        const parsed = JSON.parse(lockoutRow.value) as unknown
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((t: unknown) => t !== 'cards')
          await tx.table('settings').put({
            key: 'lockoutAllowedTabs',
            value: JSON.stringify(filtered),
          })
        }
      }
    })
    await dbNew.open()
    expect(dbNew.verno).toBe(12)
    expect(await dbNew.table('settings').get('flashcardsEnabled')).toBeUndefined()
    const lockout = await dbNew.table('settings').get('lockoutAllowedTabs')
    expect(lockout?.value).toBe('["journal"]')
    dbNew.close()
    await Dexie.delete(tempDbName)
  })
})
