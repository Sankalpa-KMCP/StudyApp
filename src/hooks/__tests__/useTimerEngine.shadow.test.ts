import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../../db/db'
import { useTimerEngine } from '../useTimerEngine'
import { resetDatabase } from '../../test/dbTestUtils'
import { buildDateString } from '../../lib/studyDashboard'

function createTimerOptions(overrides: Partial<Parameters<typeof useTimerEngine>[0]> = {}) {
  return {
    isDataReady: true,
    studyBlockDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    targetSessionsPerCycle: 4,
    initialEasinessFactor: 2.5,
    incrementStudy: vi.fn(),
    incrementBreak: vi.fn(),
    addHistoryEntry: vi.fn().mockResolvedValue(undefined),
    playChime: vi.fn(),
    createDatabaseSnapshot: vi.fn(),
    pushToast: vi.fn(),
    activeTaskId: null,
    setActiveTaskId: vi.fn(),
    focusNotificationsEnabled: false,
    ...overrides,
  }
}

describe('useTimerEngine session shadow', () => {
  beforeEach(async () => {
    await resetDatabase()
    sessionStorage.clear()
  })

  it('clears short interrupted sessions without restoring', async () => {
    const pushToast = vi.fn()
    sessionStorage.setItem('active_session_shadow', JSON.stringify({
      mode: 'study',
      secondsElapsed: 30,
      isTimerActive: true,
      categoryId: 1,
      timestamp: Date.now(),
    }))

    renderHook(() => useTimerEngine(createTimerOptions({ pushToast })))

    await waitFor(() => {
      expect(pushToast).not.toHaveBeenCalledWith('RESTORE', expect.any(String))
    })
    const shadow = JSON.parse(sessionStorage.getItem('active_session_shadow')!)
    expect(shadow.secondsElapsed).toBe(0)
    expect(shadow.isTimerActive).toBe(false)
  })

  it('restores long interrupted study sessions into daily logs', async () => {
    const pushToast = vi.fn()
    sessionStorage.setItem('active_session_shadow', JSON.stringify({
      mode: 'study',
      secondsElapsed: 120,
      isTimerActive: true,
      categoryId: 1,
      timestamp: Date.now(),
    }))

    renderHook(() => useTimerEngine(createTimerOptions({ pushToast })))

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith('RESTORE', 'Restored 2 min interrupted study block')
    })
    const log = await db.daily_logs.get(buildDateString())
    expect(log?.studyMinutes).toBe(2)
  })
})
