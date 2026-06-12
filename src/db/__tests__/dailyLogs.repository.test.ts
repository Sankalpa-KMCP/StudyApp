import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase } from '../../test/dbTestUtils'
import {
  addRecoveredMinutes,
  incrementStudyMinutes,
  incrementBreakMinutes,
  updateDailyReflection,
} from '../repositories/dailyLogs'
import { buildDateString } from '../../lib/study/studyDashboard'

describe('dailyLogs repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('incrementStudyMinutes creates or updates today log', async () => {
    await incrementStudyMinutes()
    const log = await db.daily_logs.get(buildDateString())
    expect(log?.studyMinutes).toBe(1)
    expect(log?.breakMinutes).toBe(0)

    await incrementStudyMinutes()
    const updated = await db.daily_logs.get(buildDateString())
    expect(updated?.studyMinutes).toBe(2)
  })

  it('incrementBreakMinutes creates or updates today log', async () => {
    await incrementBreakMinutes()
    const log = await db.daily_logs.get(buildDateString())
    expect(log?.breakMinutes).toBe(1)
    expect(log?.studyMinutes).toBe(0)
  })

  it('addRecoveredMinutes increments study or break minutes for today', async () => {
    await addRecoveredMinutes('study', 12)
    let log = await db.daily_logs.get(buildDateString())
    expect(log?.studyMinutes).toBe(12)

    await addRecoveredMinutes('break', 5)
    log = await db.daily_logs.get(buildDateString())
    expect(log?.breakMinutes).toBe(5)
  })

  it('updateDailyReflection upserts notes and mood', async () => {
    await updateDailyReflection('2026-06-10', 'Focused session', 'focused')
    const log = await db.daily_logs.get('2026-06-10')
    expect(log?.notes).toBe('Focused session')
    expect(log?.mood).toBe('focused')

    await updateDailyReflection('2026-06-10', 'Updated note', 'calm')
    const updated = await db.daily_logs.get('2026-06-10')
    expect(updated?.notes).toBe('Updated note')
    expect(updated?.mood).toBe('calm')
  })
})
