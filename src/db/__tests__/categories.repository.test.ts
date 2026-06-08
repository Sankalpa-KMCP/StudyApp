import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { resetDatabase, seedCategory, seedTask } from '../../test/dbTestUtils'
import { addCategory, deleteCategory, seedDefaultCategories } from '../repositories/categories'

describe('categories repository', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('addCategory inserts a row and returns the new id', async () => {
    const id = await addCategory('Science', '#3B82F6')
    const cats = await db.categories.toArray()
    expect(cats).toHaveLength(1)
    expect(cats[0].name).toBe('Science')
    expect(id).toBe(cats[0].id)
  })

  it('seedDefaultCategories only runs when empty', async () => {
    await seedDefaultCategories()
    expect(await db.categories.count()).toBe(3)
    await seedDefaultCategories()
    expect(await db.categories.count()).toBe(3)
  })

  it('deleteCategory reassigns tasks to fallback category', async () => {
    const generalId = await seedCategory('General', '#64748B')
    const devId = await seedCategory('Development', '#3B82F6')
    await seedTask('Task', devId)
    await deleteCategory(devId)
    const task = await db.tasks.toArray()
    expect(task[0].categoryId).toBe(generalId)
    expect(await db.categories.count()).toBe(1)
  })

  it('deleteCategory throws when last category', async () => {
    const id = await seedCategory('Only', '#000')
    await expect(deleteCategory(id)).rejects.toThrow(/last category/i)
  })
})
