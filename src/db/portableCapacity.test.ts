import { afterEach, describe, expect, it } from 'vitest'
import { runBackupableMutation, assertProspectiveRecordCounts, assertStrictBackupability } from './backupabilityGuard'
import { createStudyExportPayload, exportStudyData, getStudyData, importStudyData, studyDb, studyTables } from './studyDb'
import { saveQuickNotes } from './quickNotesService'
import { captureDatabaseGeneration } from './databaseMutationGuard'
import type { StudyData } from './types'

const stamp = '2026-10-11T00:00:00.000Z'
function empty(): StudyData {
  return { tasks: [], subjects: [], notes: [], events: [], studySessions: [], goals: [], settings: [] }
}
function settings(count: number): StudyData {
  return { ...empty(), settings: Array.from({ length: count }, (_, i) => ({ key: `user-${i}`, value: 'original' })) }
}
afterEach(async () => { await Promise.all(studyTables.map(table => table.clear())) })

describe('portable capacity', () => {
  it.each([62, 63, 64])('imports %i settings, edits once, and preserves available portable slots', async count => {
    await importStudyData(createStudyExportPayload(settings(count)))
    expect(await studyDb.settings.count()).toBe(count + 2)
    let calls = 0
    await runBackupableMutation(async () => {
      calls++
      await studyDb.settings.put({ key: 'user-0', value: 'edited' })
    })
    expect(calls).toBe(1)
    const context = { expectedGeneration: await captureDatabaseGeneration() }
    if (count < 64) {
      await saveQuickNotes('retained', context)
      expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['retained'])
    } else {
      await expect(saveQuickNotes('retained', context)).rejects.toThrow(/limit/)
      expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
    }
    const exported = await exportStudyData()
    expect(exported.settings).toHaveLength(count + (count < 64 ? 1 : 0))
    await importStudyData(exported)
    expect(await captureDatabaseGeneration()).toBe(context.expectedGeneration + 1)
    await expect(saveQuickNotes('obsolete', context)).rejects.toThrow(/generation/)
    expect((await exportStudyData()).settings).toEqual(exported.settings)
    expect((await studyDb.settings.get('user-0'))?.value).toBe('edited')
  })

  it.each([[], ['databaseGeneration'], ['legacy-localstorage-migrated-v1'], ['databaseGeneration', 'legacy-localstorage-migrated-v1']].map(keys => ({ keys })))('excludes only known internal keys: $keys', ({ keys }) => {
    const data = settings(64)
    data.settings.push(...keys.map(key => ({ key, value: true })))
    expect(() => assertProspectiveRecordCounts(data)).not.toThrow()
    data.settings.push({ key: 'unknown-internal-looking-key', value: true })
    expect(() => assertProspectiveRecordCounts(data)).toThrow(/settings/)
  })

  it('counts active focus normally and preserves genuine grandfathering and rollback', async () => {
    const data = settings(64)
    data.settings.push({ key: 'activeFocusSession', value: { id: 'focus', subjectId: '', startedAt: stamp, plannedMinutes: 25, status: 'paused', pausedAt: stamp, accumulatedPausedMs: 0, checkpointElapsedMs: 600_000 } })
    await studyDb.settings.bulkPut([...data.settings, { key: 'databaseGeneration', value: 1 }, { key: 'legacy-localstorage-migrated-v1', value: true }])
    let calls = 0
    await runBackupableMutation(async () => { calls++; await studyDb.settings.put({ key: 'user-0', value: 'edit' }) })
    expect(calls).toBe(2)
    await expect(runBackupableMutation(async () => { await studyDb.settings.put({ key: 'extra', value: 'no' }) })).rejects.toThrow(/settings/)
    expect(await studyDb.settings.get('extra')).toBeUndefined()
    await runBackupableMutation(async () => { await studyDb.settings.delete('user-1') })
    calls = 0
    await runBackupableMutation(async () => { calls++; await studyDb.settings.put({ key: 'user-0', value: 'again' }) })
    expect(calls).toBe(1)
  })

  it('accepts portable limits even when a legacy input supplies internal metadata', async () => {
    const data = settings(64)
    data.settings.push({ key: 'databaseGeneration', value: 99 }, { key: 'legacy-localstorage-migrated-v1', value: true })
    await importStudyData({ ...createStudyExportPayload(empty()), ...data })
    expect(await studyDb.settings.count()).toBe(66)
    expect((await studyDb.settings.get('databaseGeneration'))?.value).not.toBe(99)
    expect((await exportStudyData()).settings).toHaveLength(64)
    data.settings.push({ key: 'user-65', value: true })
    await expect(importStudyData({ ...createStudyExportPayload(empty()), ...data })).rejects.toThrow()
    expect(await studyDb.settings.get('user-65')).toBeUndefined()
  })

  it('rejects an actual oversized canonical JSON payload and rolls back a guarded write', async () => {
    const note = { id: 'large', title: 'Note', body: 'x'.repeat(64 * 1024 * 1024), subjectId: '', tags: [], createdAt: stamp, updatedAt: stamp }
    await expect(runBackupableMutation(async () => { await studyDb.notes.put(note) })).rejects.toThrow(/64 MiB/)
    expect(await studyDb.notes.get('large')).toBeUndefined()
  }, 20_000)

  it('allows an imported 25,000-portable-record workspace without false retries', async () => {
    const data = settings(1)
    data.notes = Array.from({ length: 5000 }, (_, i) => ({ id: `n${i}`, title: 'Note', body: '', subjectId: '', tags: [], createdAt: stamp, updatedAt: stamp }))
    data.tasks = Array.from({ length: 5000 }, (_, i) => ({ id: `t${i}`, title: 'Task', subjectId: '', dueDate: '', priority: 'normal', status: 'open', minutes: 10, createdAt: stamp, updatedAt: stamp }))
    data.events = Array.from({ length: 5000 }, (_, i) => ({ id: `e${i}`, title: 'Event', subjectId: '', startAt: stamp, endAt: stamp, location: '', createdAt: stamp, updatedAt: stamp }))
    data.studySessions = Array.from({ length: 9999 }, (_, i) => ({ id: `s${i}`, subjectId: '', minutes: 10, note: '', startedAt: stamp, endedAt: stamp }))
    await importStudyData(createStudyExportPayload(data))
    let calls = 0
    await runBackupableMutation(async () => { calls++; await studyDb.notes.update('n0', { title: 'Edited' }) })
    expect(calls).toBe(1)
    await expect(runBackupableMutation(async () => { await studyDb.settings.put({ key: 'extra', value: 'no' }) })).rejects.toThrow(/Total record/)
    expect(await studyDb.settings.get('extra')).toBeUndefined()
    await studyDb.studySessions.delete('s0')
    await runBackupableMutation(async () => { await studyDb.settings.put({ key: 'extra', value: 'yes' }) })
    const snapshot = await getStudyData()
    expect(() => assertStrictBackupability(snapshot)).not.toThrow()
  }, 20_000)
})
