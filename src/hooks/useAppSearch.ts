import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { buildSearchResults, isFlashcardDue, type SearchResult } from '../appUtils'
import type { CalendarEvent, Flashcard, StudyData, StudyNote, StudySubject, StudyTask } from '../db/types'

export type TaskSearchFilter = 'all' | 'open' | 'done'

export type UseAppSearchOptions = {
  data: StudyData
  subjectMap: Map<string, StudySubject>
  taskFilter: TaskSearchFilter
}

export type UseAppSearchResult = {
  search: string
  setSearch: (value: string) => void
  deferredSearch: string
  clearSearch: () => void
  homeSearchResults: SearchResult[]
  filteredTasks: StudyTask[]
  filteredNotes: StudyNote[]
  filteredSubjects: StudySubject[]
  filteredEvents: CalendarEvent[]
  filteredFlashcards: Flashcard[]
}

/**
 * Application search: input state, deferred query, workspace entity filters,
 * and Home cross-entity results via `buildSearchResults`.
 */
export function useAppSearch({
  data,
  subjectMap,
  taskFilter,
}: UseAppSearchOptions): UseAppSearchResult {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = deferredSearch.trim().toLowerCase()

  const homeSearchResults = useMemo(
    () => buildSearchResults(data, subjectMap, deferredSearch),
    [data, deferredSearch, subjectMap],
  )

  const filteredTasks = useMemo(() => data.tasks.filter((task) => {
    const subject = subjectMap.get(task.subjectId)?.name ?? 'General'
    const matchesSearch = `${task.title} ${subject} ${task.priority}`.toLowerCase().includes(normalizedSearch)
    const matchesFilter = taskFilter === 'all' || task.status === taskFilter
    return matchesSearch && matchesFilter
  }), [data.tasks, normalizedSearch, subjectMap, taskFilter])

  const filteredNotes = useMemo(() => data.notes.filter((note) => {
    const subject = subjectMap.get(note.subjectId)?.name ?? 'General'
    return `${note.title} ${note.body} ${subject} ${note.tags.join(' ')}`.toLowerCase().includes(normalizedSearch)
  }), [data.notes, normalizedSearch, subjectMap])

  const filteredSubjects = useMemo(
    () => data.subjects.filter((subject) => `${subject.name} ${subject.progress}`.toLowerCase().includes(normalizedSearch)),
    [data.subjects, normalizedSearch],
  )

  const filteredEvents = useMemo(() => data.events.filter((event) => {
    const subject = subjectMap.get(event.subjectId)?.name ?? 'General'
    return `${event.title} ${event.location} ${subject}`.toLowerCase().includes(normalizedSearch)
  }), [data.events, normalizedSearch, subjectMap])

  const filteredFlashcards = useMemo(() => data.flashcards.filter((card) => {
    const subject = subjectMap.get(card.subjectId)?.name ?? 'General'
    return `${card.front} ${card.back} ${subject} ${card.status}`.toLowerCase().includes(normalizedSearch)
  }).sort((a, b) => Number(isFlashcardDue(b)) - Number(isFlashcardDue(a))), [data.flashcards, normalizedSearch, subjectMap])

  const clearSearch = useCallback(() => setSearch(''), [])

  return {
    search,
    setSearch,
    deferredSearch,
    clearSearch,
    homeSearchResults,
    filteredTasks,
    filteredNotes,
    filteredSubjects,
    filteredEvents,
    filteredFlashcards,
  }
}
