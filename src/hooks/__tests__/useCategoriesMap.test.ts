import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCategoriesMap } from '../useCategoriesMap'

describe('useCategoriesMap', () => {
  it('maps category id to item', () => {
    const { result } = renderHook(() =>
      useCategoriesMap([{ id: 1, name: 'Math', color: '#3b82f6' }]),
    )
    expect(result.current.get(1)?.name).toBe('Math')
  })
})
