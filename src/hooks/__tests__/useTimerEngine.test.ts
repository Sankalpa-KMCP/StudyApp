import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimerEngine } from '../useTimerEngine'
import { resetDatabase } from '../../test/dbTestUtils'

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
    schedulingAlgorithm: 'sm2' as const,
    sessionTasks: [],
    categories: [],
    ...overrides,
  }
}

describe('useTimerEngine', () => {
  beforeEach(async () => {
    await resetDatabase()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('ticks remainingSeconds down when timer is active', () => {
    const { result } = renderHook(() => useTimerEngine(createTimerOptions()))
    act(() => result.current.controls.setIsTimerActive(true))
    expect(result.current.display.remainingSeconds).toBe(25 * 60)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.display.secondsElapsed).toBe(1)
    expect(result.current.display.remainingSeconds).toBe(25 * 60 - 1)
  })

  it('opens reflection modal when completing a study session', async () => {
    const { result } = renderHook(() => useTimerEngine(createTimerOptions()))
    act(() => {
      result.current.controls.setIsTimerActive(true)
    })
    await act(async () => {
      await result.current.controls.completeSession()
    })
    expect(result.current.controls.showReflectionModal).toBe(true)
    expect(result.current.controls.pendingSessionData?.mode).toBe('study')
  })

  it('switches between study and break modes', () => {
    const playChime = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ playChime })))
    act(() => result.current.controls.handleModeSwitch('break'))
    expect(result.current.controls.timerMode).toBe('break')
    expect(playChime).toHaveBeenCalled()
    act(() => result.current.controls.handleModeSwitch('study'))
    expect(result.current.controls.timerMode).toBe('study')
  })

  it('resets timer state', () => {
    const setActiveTaskId = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ setActiveTaskId })))
    act(() => {
      result.current.controls.setIsTimerActive(true)
      result.current.controls.resetTimerState()
    })
    expect(result.current.controls.isTimerActive).toBe(false)
    expect(result.current.controls.timerMode).toBe('study')
    expect(result.current.display.secondsElapsed).toBe(0)
    expect(setActiveTaskId).toHaveBeenCalledWith(null)
  })

  it('sends focus notification when study block completes and notifications enabled', async () => {
    const instances: unknown[] = []
    class MockNotification {
      static permission = 'granted'
      constructor() {
        instances.push(this)
      }
    }
    vi.stubGlobal('Notification', MockNotification)

    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ focusNotificationsEnabled: true })))
    await act(async () => {
      await result.current.controls.processSessionCompletion(60, 'study', '2026-06-11 10:00', 1)
    })

    expect(instances.length).toBe(1)
    vi.unstubAllGlobals()
  })

  it('does not pause when document becomes hidden while timer is active', () => {
    const pushToast = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ pushToast })))
    act(() => result.current.controls.setIsTimerActive(true))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.controls.isTimerActive).toBe(true)
    expect(pushToast).not.toHaveBeenCalledWith('PAUSE', expect.any(String))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('syncs elapsed from wall clock when returning from hidden', () => {
    const { result } = renderHook(() => useTimerEngine(createTimerOptions()))
    act(() => result.current.controls.setIsTimerActive(true))
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.display.secondsElapsed).toBe(5)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => vi.advanceTimersByTime(120_000))

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.controls.isTimerActive).toBe(true)
    expect(result.current.display.secondsElapsed).toBe(125)
  })

  it('rolls over midnight when computing session timestamp', async () => {
    vi.setSystemTime(new Date('2026-06-10T23:59:50Z'))
    const addHistoryEntry = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useTimerEngine(createTimerOptions({
        studyBlockDurationMinutes: 1,
        addHistoryEntry,
      })),
    )
    act(() => result.current.controls.setIsTimerActive(true))
    await act(async () => {
      vi.advanceTimersByTime(15 * 1000)
      await result.current.controls.completeSession()
    })
    expect(result.current.controls.pendingSessionData?.timestamp).toBeTruthy()
    vi.useRealTimers()
  })

  it('auto-completes when elapsed reaches target for break mode', async () => {
    const addHistoryEntry = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useTimerEngine(createTimerOptions({
        studyBlockDurationMinutes: 1,
        shortBreakDurationMinutes: 1,
        addHistoryEntry,
      })),
    )
    act(() => {
      result.current.controls.handleModeSwitch('break')
      result.current.controls.setIsTimerActive(true)
    })
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(addHistoryEntry).toHaveBeenCalled()
  })
})
