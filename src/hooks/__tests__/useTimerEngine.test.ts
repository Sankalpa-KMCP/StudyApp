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
    autoPauseOnHidden: true,
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
  })

  it('ticks remainingSeconds down when timer is active', () => {
    const { result } = renderHook(() => useTimerEngine(createTimerOptions()))
    act(() => result.current.setIsTimerActive(true))
    expect(result.current.remainingSeconds).toBe(25 * 60)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.secondsElapsed).toBe(1)
    expect(result.current.remainingSeconds).toBe(25 * 60 - 1)
  })

  it('opens reflection modal when completing a study session', async () => {
    const { result } = renderHook(() => useTimerEngine(createTimerOptions()))
    act(() => {
      result.current.setIsTimerActive(true)
    })
    await act(async () => {
      await result.current.completeSession()
    })
    expect(result.current.showReflectionModal).toBe(true)
    expect(result.current.pendingSessionData?.mode).toBe('study')
  })

  it('switches between study and break modes', () => {
    const playChime = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ playChime })))
    act(() => result.current.handleModeSwitch('break'))
    expect(result.current.timerMode).toBe('break')
    expect(playChime).toHaveBeenCalled()
    act(() => result.current.handleModeSwitch('study'))
    expect(result.current.timerMode).toBe('study')
  })

  it('resets timer state', () => {
    const setActiveTaskId = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ setActiveTaskId })))
    act(() => {
      result.current.setIsTimerActive(true)
      result.current.resetTimerState()
    })
    expect(result.current.isTimerActive).toBe(false)
    expect(result.current.timerMode).toBe('study')
    expect(result.current.secondsElapsed).toBe(0)
    expect(setActiveTaskId).toHaveBeenCalledWith(null)
  })

  it('pauses when document becomes hidden while timer is active', () => {
    const pushToast = vi.fn()
    const { result } = renderHook(() => useTimerEngine(createTimerOptions({ pushToast })))
    act(() => result.current.setIsTimerActive(true))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.isTimerActive).toBe(false)
    expect(pushToast).toHaveBeenCalledWith('PAUSE', 'PAUSED - WORKSPACE INACTIVE')
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
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
    act(() => result.current.setIsTimerActive(true))
    await act(async () => {
      vi.advanceTimersByTime(15 * 1000)
      await result.current.completeSession()
    })
    expect(result.current.pendingSessionData?.timestamp).toBeTruthy()
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
      result.current.handleModeSwitch('break')
      result.current.setIsTimerActive(true)
    })
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(addHistoryEntry).toHaveBeenCalled()
  })
})
