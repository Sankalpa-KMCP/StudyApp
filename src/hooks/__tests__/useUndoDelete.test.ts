import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoDelete } from '../useUndoDelete'

describe('useUndoDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits delete after timeout and supports undo', () => {
    const setActiveToast = vi.fn()
    const onCommit = vi.fn()
    const onUndo = vi.fn()
    const { result } = renderHook(() => useUndoDelete({ setActiveToast }))

    act(() => {
      result.current.scheduleDelete('Note', onCommit, onUndo)
    })

    expect(setActiveToast).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()

    const toastArg = setActiveToast.mock.calls[0][0]
    act(() => toastArg.action.onClick())
    expect(onUndo).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()

    act(() => {
      result.current.scheduleDelete('Card', onCommit, onUndo)
    })
    act(() => vi.advanceTimersByTime(5000))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})
