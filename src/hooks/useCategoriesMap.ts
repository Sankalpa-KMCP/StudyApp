import { useMemo } from 'react'
import type { CategoryItem } from '../db/types'

export function useCategoriesMap(categories: CategoryItem[]) {
  return useMemo(() => {
    const map = new Map<number, { name: string; color: string }>()
    categories.forEach(c => {
      if (c.id !== undefined) map.set(c.id, c)
    })
    return map
  }, [categories])
}
