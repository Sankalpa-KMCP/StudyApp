import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGoal, deleteGoal, updateGoal } from './goalService'
import { DATABASE_GENERATION_KEY, StaleDatabaseGenerationError } from './databaseGeneration'
import { installInMemoryLockAdapter } from './crossTabLock'
import { studyDb } from './studyDb'

describe('goalService', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates a non-qualifying goal without changing dailyGoalMinutes', async () => {
    const created = await createGoal({
      title: 'Weekly target',
      target: 5,
      progress: 0,
      period: 'weekly',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    expect(created.id).toMatch(/^goal-/)
    expect(created).toMatchObject({
      title: 'Weekly target',
      target: 5,
      period: 'weekly',
      metric: 'study_time',
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(await studyDb.goals.get(created.id)).toEqual(created)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('rejects createGoal when generation is stale', async () => {
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })

    await expect(createGoal({
      title: 'Stale goal',
      target: 5,
      progress: 0,
      period: 'weekly',
      metric: 'study_time',
    }, { expectedGeneration: 2 })).rejects.toThrow(StaleDatabaseGenerationError)

    expect(await studyDb.goals.count()).toBe(0)
  })

  it('updates a non-qualifying goal without changing dailyGoalMinutes', async () => {
    const original = await createGoal({
      title: 'Manual daily',
      target: 40,
      progress: 5,
      period: 'daily',
      metric: 'manual',
    }, { expectedGeneration: 1 })

    await updateGoal(original.id, {
      title: 'Manual weekly',
      target: 55,
      progress: 11,
      period: 'weekly',
      metric: 'manual',
    }, { expectedGeneration: 1 })

    const stored = await studyDb.goals.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      title: 'Manual weekly',
      target: 55,
      progress: 11,
      period: 'weekly',
      metric: 'manual',
      createdAt: original.createdAt,
    })
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('creates a daily study-time goal and syncs dailyGoalMinutes', async () => {
    const created = await createGoal({
      title: 'Daily study',
      target: 80,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    expect(await studyDb.goals.get(created.id)).toEqual(created)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(80)
  })

  it('updates a daily study-time goal and overwrites dailyGoalMinutes', async () => {
    const original = await createGoal({
      title: 'Daily study',
      target: 80,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    await updateGoal(original.id, {
      title: 'Daily study renamed',
      target: 95,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    expect(await studyDb.goals.get(original.id)).toMatchObject({
      title: 'Daily study renamed',
      target: 95,
      metric: 'study_time',
      period: 'daily',
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(95)
  })

  it('throws when updating a missing qualifying goal and leaves dailyGoalMinutes unchanged', async () => {
    await expect(updateGoal('goal-missing-daily', {
      title: 'Gone daily',
      target: 90,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })).rejects.toThrow('Goal no longer exists.')
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('throws when updating a missing goal without syncing settings', async () => {
    await expect(updateGoal('goal-missing', {
      title: 'Gone',
      target: 30,
      progress: 0,
      period: 'daily',
      metric: 'manual',
    }, { expectedGeneration: 1 })).rejects.toThrow('Goal no longer exists.')
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('rejects updateGoal when generation is stale', async () => {
    const original = await createGoal({
      title: 'Original',
      target: 40,
      progress: 0,
      period: 'daily',
      metric: 'manual',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(updateGoal(original.id, {
      title: 'Stale update',
      target: 50,
      progress: 0,
      period: 'daily',
      metric: 'manual',
    }, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
  })

  it('rolls back settings when a qualifying goal write fails', async () => {
    vi.spyOn(studyDb.goals, 'add').mockRejectedValueOnce(new Error('goal write failed'))

    await expect(createGoal({
      title: 'Broken daily',
      target: 90,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })).rejects.toThrow('goal write failed')

    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('rolls back the goal when dailyGoalMinutes write fails', async () => {
    const originalPut = studyDb.settings.put.bind(studyDb.settings)
    vi.spyOn(studyDb.settings, 'put').mockImplementation(async (entry) => {
      if (entry.key === 'dailyGoalMinutes' && entry.value === 90) {
        throw new Error('settings write failed')
      }
      return originalPut(entry)
    })

    await expect(createGoal({
      title: 'Atomic daily',
      target: 90,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })).rejects.toThrow('settings write failed')

    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('leaves dailyGoalMinutes unchanged when a goal transitions away from qualifying state', async () => {
    const original = await createGoal({
      title: 'Daily study',
      target: 75,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)

    await updateGoal(original.id, {
      title: 'Weekly study',
      target: 5,
      progress: 0,
      period: 'weekly',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    expect(await studyDb.goals.get(original.id)).toMatchObject({
      period: 'weekly',
      metric: 'study_time',
      target: 5,
    })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(75)
  })

  it('lets the last successful daily study-time save win dailyGoalMinutes', async () => {
    await createGoal({
      title: 'First daily',
      target: 60,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })
    await createGoal({
      title: 'Second daily',
      target: 110,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    expect(await studyDb.goals.count()).toBe(2)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(110)
  })

  it('deletes a daily study-time goal without changing dailyGoalMinutes', async () => {
    const created = await createGoal({
      title: 'Delete me',
      target: 70,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(70)

    await deleteGoal(created.id, { expectedGeneration: 1 })
    expect(await studyDb.goals.get(created.id)).toBeUndefined()
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(70)
  })

  it('treats deleting a missing goal as success', async () => {
    await expect(deleteGoal('goal-already-gone', { expectedGeneration: 1 })).resolves.toBeUndefined()
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)
  })

  it('rejects deleteGoal when generation is stale', async () => {
    const created = await createGoal({
      title: 'Delete me',
      target: 70,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })

    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })

    await expect(deleteGoal(created.id, { expectedGeneration: 1 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await studyDb.goals.get(created.id)).toBeDefined()
  })

  it('rejects createGoal with domain-invalid fields and preserves goals store and dailyGoalMinutes setting', async () => {
    // Blank title
    await expect(
      createGoal({
        title: '   ',
        target: 60,
        progress: 0,
        period: 'daily',
        metric: 'study_time',
      }, { expectedGeneration: 1 })
    ).rejects.toThrow('Goal title must be a non-blank string.')
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)

    // Non-positive target (target <= 0)
    await expect(
      createGoal({
        title: 'Zero Target Goal',
        target: 0,
        progress: 0,
        period: 'daily',
        metric: 'study_time',
      }, { expectedGeneration: 1 })
    ).rejects.toThrow('Goal target must be a positive finite number.')
    expect(await studyDb.goals.count()).toBe(0)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(120)

    // Negative progress
    await expect(
      createGoal({
        title: 'Negative Progress Goal',
        target: 60,
        progress: -10,
        period: 'weekly',
        metric: 'manual',
      }, { expectedGeneration: 1 })
    ).rejects.toThrow('Goal progress must be a non-negative finite number.')
    expect(await studyDb.goals.count()).toBe(0)
  })

  it('preserves valid unusual goal configurations such as manual progress > target', async () => {
    const created = await createGoal({
      title: 'Exceeded Goal',
      target: 10,
      progress: 15,
      period: 'weekly',
      metric: 'manual',
    }, { expectedGeneration: 1 })

    expect(created.progress).toBe(15)
    expect(await studyDb.goals.count()).toBe(1)
  })

  it('rejects updateGoal with domain-invalid fields, leaves record untouched, and does not alter settings', async () => {
    const original = await createGoal({
      title: 'Original Daily Goal',
      target: 90,
      progress: 0,
      period: 'daily',
      metric: 'study_time',
    }, { expectedGeneration: 1 })
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(90)

    // Try to update with invalid target: 0
    await expect(
      updateGoal(original.id, {
        title: 'Updated Daily Goal',
        target: 0,
        progress: 0,
        period: 'daily',
        metric: 'study_time',
      }, { expectedGeneration: 1 })
    ).rejects.toThrow('Goal target must be a positive finite number.')

    const afterFailedUpdate = await studyDb.goals.get(original.id)
    expect(afterFailedUpdate).toEqual(original)
    expect((await studyDb.settings.get('dailyGoalMinutes'))?.value).toBe(90)
  })
})
