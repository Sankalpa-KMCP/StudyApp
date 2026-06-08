import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCategories } from '../hooks'
import { db } from '../db'
import { resetDatabase, seedCategory, seedTask } from '../../test/dbTestUtils'

describe('useCategories deleteCategory', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('reassigns tasks when deleting a category', async () => {
    const generalId = await seedCategory('General', '#64748B')
    const devId = await seedCategory('Development', '#3B82F6')
    await seedTask('Learn React', devId)

    const { result } = renderHook(() => useCategories())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.deleteCategory(devId)
    })

    const tasks = await db.tasks.toArray()
    expect(tasks[0].categoryId).toBe(generalId)
    const categories = await db.categories.toArray()
    expect(categories).toHaveLength(1)
  })

  it('throws when deleting the last category', async () => {
    await seedCategory('General', '#64748B')
    const { result } = renderHook(() => useCategories())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const only = result.current.categories[0]
    await expect(result.current.deleteCategory(only.id!)).rejects.toThrow('last category')
  })
})
