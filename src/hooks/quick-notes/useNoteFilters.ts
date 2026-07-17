import { useMemo, useState } from 'react'
import type { CategoryItem, QuickNoteItem } from '../../db/types'

export function useNoteFilters(notes: QuickNoteItem[], categories: CategoryItem[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<'all' | number>('all')

  const categoriesMap = useMemo(() => {
    const map = new Map<number, CategoryItem>()
    categories.forEach(c => {
      if (c.id !== undefined) map.set(c.id, c)
    })
    return map
  }, [categories])

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const cat = n.categoryId !== undefined ? categoriesMap.get(n.categoryId) : undefined
      const catName = cat ? cat.name.toLowerCase() : ''

      const tagsInQuery = searchQuery.match(/#(\w+)/g)
      let matchesSearch: boolean

      if (tagsInQuery) {
        const tagNames = tagsInQuery.map(t => t.substring(1).toLowerCase())
        const matchesTags = tagNames.every(tn => catName.replace(/\s+/g, '').includes(tn))
        const cleanQuery = searchQuery.replace(/#\w+/g, '').trim().toLowerCase()
        const matchesText =
          cleanQuery === '' ||
          n.title.toLowerCase().includes(cleanQuery) ||
          n.content.toLowerCase().includes(cleanQuery)
        matchesSearch = matchesTags && matchesText
      } else {
        const q = searchQuery.toLowerCase()
        matchesSearch =
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          catName.includes(q)
      }

      const matchesCategory = activeCategoryId === 'all' || n.categoryId === activeCategoryId
      return matchesSearch && matchesCategory
    })
  }, [notes, searchQuery, activeCategoryId, categoriesMap])

  return {
    searchQuery,
    setSearchQuery,
    searchFocused,
    setSearchFocused,
    activeCategoryId,
    setActiveCategoryId,
    categoriesMap,
    filteredNotes,
  }
}
