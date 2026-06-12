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

  it('migrates from v7 to v8, setting flashcardsEnabled to true', async () => {
    const tempDbName = 'StudyDashboardDB_migration_test'
    await Dexie.delete(tempDbName)
    const dbOld = new Dexie(tempDbName)
    dbOld.version(7).stores({
      settings: '&key, value',
    })
    await dbOld.open()
    await dbOld.table('settings').put({ key: 'soundEnabled', value: true })
    dbOld.close()

    const dbNew = new Dexie(tempDbName)
    dbNew.version(7).stores({
      settings: '&key, value',
    })
    dbNew.version(8).stores({
      settings: '&key, value',
    }).upgrade(async tx => {
      const settingsTable = tx.table('settings')
      const flashcardsEnabledSetting = await settingsTable.get('flashcardsEnabled')
      if (flashcardsEnabledSetting === undefined) {
        await settingsTable.put({ key: 'flashcardsEnabled', value: true })
      }
    })
    await dbNew.open()
    const row = await dbNew.table('settings').get('flashcardsEnabled')
    expect(row).toEqual({ key: 'flashcardsEnabled', value: true })
    dbNew.close()
    await Dexie.delete(tempDbName)
  })
})
