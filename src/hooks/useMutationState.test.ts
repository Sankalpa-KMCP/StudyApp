import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMutationState } from './useMutationState'

describe('useMutationState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in an idle state with no message', () => {
    const { result } = renderHook(() => useMutationState())

    expect(result.current.phase).toBe('idle')
    expect(result.current.message).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it('enters pending while an action is unresolved', async () => {
    const { result } = renderHook(() => useMutationState())
    let resolveAction!: () => void
    const action = vi.fn(() => new Promise<void>((resolve) => {
      resolveAction = resolve
    }))

    let runPromise: Promise<boolean>
    act(() => {
      runPromise = result.current.run(action, { errorMessage: 'Could not save.' })
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(result.current.phase).toBe('pending')
    expect(result.current.message).toBeNull()

    await act(async () => {
      resolveAction()
      await runPromise
    })
  })

  it('returns true and records a success message after a successful action', async () => {
    const { result } = renderHook(() => useMutationState())
    const action = vi.fn(async () => undefined)
    const onSuccess = vi.fn()

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.run(action, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save.',
        onSuccess,
      })
    })

    expect(succeeded).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('success')
    expect(result.current.message).toBe('Saved.')
    expect(result.current.isPending).toBe(false)
  })

  it('returns false, stores only the friendly error, and logs the raw error', async () => {
    const { result } = renderHook(() => useMutationState())
    const rawError = new Error('IndexedDB abort: constraint failure detail')
    const action = vi.fn(async () => {
      throw rawError
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let succeeded = true
    await act(async () => {
      succeeded = await result.current.run(action, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save this item. Try again.',
      })
    })

    expect(succeeded).toBe(false)
    expect(result.current.phase).toBe('error')
    expect(result.current.message).toBe('Could not save this item. Try again.')
    expect(result.current.message).not.toContain('IndexedDB')
    expect(result.current.message).not.toContain('constraint failure')
    expect(result.current.isPending).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(rawError)
  })

  it('blocks a duplicate run while pending and executes the action only once', async () => {
    const { result } = renderHook(() => useMutationState())
    let resolveAction!: () => void
    const action = vi.fn(() => new Promise<void>((resolve) => {
      resolveAction = resolve
    }))

    let first: Promise<boolean>
    let second = true
    act(() => {
      first = result.current.run(action, { errorMessage: 'Could not save.' })
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      second = await result.current.run(action, { errorMessage: 'Could not save.' })
    })

    expect(second).toBe(false)
    expect(action).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAction()
      await first
    })

    expect(await first!).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('clears feedback after success without affecting a later pending run', async () => {
    const { result } = renderHook(() => useMutationState())

    await act(async () => {
      await result.current.run(async () => undefined, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save.',
      })
    })

    expect(result.current.phase).toBe('success')

    act(() => {
      result.current.clearFeedback()
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.message).toBeNull()
  })

  it('does not clear feedback while a mutation is pending', async () => {
    const { result } = renderHook(() => useMutationState())
    let resolveAction!: () => void
    const action = () => new Promise<void>((resolve) => {
      resolveAction = resolve
    })

    let runPromise: Promise<boolean>
    act(() => {
      runPromise = result.current.run(action, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save.',
      })
    })

    await waitFor(() => expect(result.current.phase).toBe('pending'))

    act(() => {
      result.current.clearFeedback()
    })

    expect(result.current.phase).toBe('pending')

    await act(async () => {
      resolveAction()
      await runPromise
    })
  })

  it('allows a failed action to be retried successfully and clears pending after rejection', async () => {
    const { result } = renderHook(() => useMutationState())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const action = vi.fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(undefined)

    let first = true
    await act(async () => {
      first = await result.current.run(action, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save. Try again.',
      })
    })

    expect(first).toBe(false)
    expect(result.current.phase).toBe('error')
    expect(result.current.isPending).toBe(false)

    let second = false
    await act(async () => {
      second = await result.current.run(action, {
        successMessage: 'Saved.',
        errorMessage: 'Could not save. Try again.',
      })
    })

    expect(second).toBe(true)
    expect(result.current.phase).toBe('success')
    expect(result.current.message).toBe('Saved.')
    expect(result.current.isPending).toBe(false)
    expect(action).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })
})
