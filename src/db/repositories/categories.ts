import { db } from '../db'
import type { CategoryItem } from '../types'

export async function getAllCategories(): Promise<CategoryItem[]> {
  return db.categories.toArray()
}

export async function addCategory(name: string, color: string, dailyGoalMinutes?: number): Promise<number> {
  return db.categories.add({ name, color, ...(dailyGoalMinutes ? { dailyGoalMinutes } : {}) })
}

export async function updateCategory(id: number, updates: { name?: string; color?: string; dailyGoalMinutes?: number }) {
  await db.categories.update(id, updates)
}

export async function deleteCategory(id: number) {
  const allCategories = await db.categories.toArray()
  if (allCategories.length <= 1) {
    throw new Error('Cannot delete the last category')
  }
  const general = allCategories.find(c => c.name === 'General' && c.id !== id)
  const fallbackId = general?.id ?? allCategories.find(c => c.id !== id)?.id

  await db.transaction('rw', [db.tasks, db.history, db.flashcards, db.quick_notes, db.categories], async () => {
    if (fallbackId !== undefined) {
      await db.tasks.where('categoryId').equals(id).modify({ categoryId: fallbackId })
      await db.history.where('categoryId').equals(id).modify({ categoryId: fallbackId })
      await db.flashcards.where('categoryId').equals(id).modify({ categoryId: fallbackId })
      await db.quick_notes.where('categoryId').equals(id).modify({ categoryId: fallbackId })
    } else {
      await db.tasks.where('categoryId').equals(id).modify({ categoryId: undefined })
      await db.history.where('categoryId').equals(id).modify({ categoryId: undefined })
      await db.flashcards.where('categoryId').equals(id).modify({ categoryId: undefined })
      await db.quick_notes.where('categoryId').equals(id).modify({ categoryId: undefined })
    }
    await db.categories.delete(id)
  })
}

export async function seedDefaultCategories() {
  const count = await db.categories.count()
  if (count === 0) {
    await db.categories.bulkAdd([
      { name: 'General', color: '#64748B' },
      { name: 'Development', color: '#3B82F6' },
      { name: 'Mathematics', color: '#8B5CF6' },
    ])
  }
}
