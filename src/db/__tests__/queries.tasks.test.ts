import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTasks, useHistory } from '../hooks'
import { resetDatabase } from '../../test/dbTestUtils'

describe('useTasks', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('adds and toggles tasks', async () => {
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('Read chapter 1')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    expect(result.current.tasks[0].text).toBe('Read chapter 1')
    expect(result.current.tasks[0].completed).toBe(false)

    const id = result.current.tasks[0].id!
    await act(async () => {
      await result.current.toggleTask(id)
    })
    await waitFor(() => expect(result.current.tasks[0].completed).toBe(true))
  })
})

describe('useHistory', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('adds entries with createdAt', async () => {
    const { result } = renderHook(() => useHistory())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addEntry({
        timestamp: '',
        type: 'study',
        durationMinutes: 25,
      })
    })
    await waitFor(() => expect(result.current.history).toHaveLength(1))
    expect(result.current.history[0].createdAt).toBeGreaterThan(0)
    expect(result.current.history[0].timestamp).toMatch(/^\w+ \d+, \d{2}:\d{2}$/)
  })
})
