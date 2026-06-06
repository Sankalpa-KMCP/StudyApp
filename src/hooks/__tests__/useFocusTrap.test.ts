import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from '../useFocusTrap'

describe('useFocusTrap', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() => useFocusTrap(false))
    expect(result.current).toHaveProperty('current')
  })
})
