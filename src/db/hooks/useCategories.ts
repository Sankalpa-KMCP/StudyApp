import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import * as categoryRepo from '../repositories/categories'

export function useCategories() {
  const categories = useLiveQuery(() => db.categories.toArray())

  useEffect(() => {
    if (categories !== undefined && categories.length === 0) {
      void categoryRepo.seedDefaultCategories()
    }
  }, [categories])

  return {
    categories: categories ?? [],
    addCategory: categoryRepo.addCategory,
    updateCategory: categoryRepo.updateCategory,
    deleteCategory: categoryRepo.deleteCategory,
    isLoading: categories === undefined,
  }
}
