import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import {
  buildSearchResults,
  calculateSubjectProgress,
  getCreditedSubjectStudyMinutesMap,
  type SearchResult,
} from '../appUtils'
import type { CalendarEvent, StudyNote, StudySession, StudySubject, StudyTask } from '../db/types'

export type TaskSearchFilter = 'all' | 'open' | 'done'

export type UseAppSearchOptions = {
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  tasks: StudyTask[]
  studySessions: StudySession[]
  subjectMap: Map<string, StudySubject>
  taskFilter: TaskSearchFilter
  now?: Date
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
}

/**
 * Application search: input state, deferred query, workspace entity filters,
 * and cross-entity results via `buildSearchResults`.
 */
export function useAppSearch({
  subjects,
  notes,
  events,
  tasks,
  studySessions,
  subjectMap,
  taskFilter,
  now,
}: UseAppSearchOptions): UseAppSearchResult {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = deferredSearch.trim().toLowerCase()

  const sessionMinutesMap = useMemo(
    () => getCreditedSubjectStudyMinutesMap(studySessions, now),
    [now, studySessions],
  )

  const homeSearchResults = useMemo(
    () => buildSearchResults(subjects, notes, events, tasks, sessionMinutesMap, subjectMap, deferredSearch, now),
    [deferredSearch, events, notes, now, sessionMinutesMap, subjectMap, subjects, tasks],
  )

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const subject = subjectMap.get(task.subjectId)?.name ?? 'General'
    const matchesSearch = `${task.title} ${subject} ${task.priority}`.toLowerCase().includes(normalizedSearch)
    const matchesFilter = taskFilter === 'all' || task.status === taskFilter
    return matchesSearch && matchesFilter
  }), [normalizedSearch, subjectMap, taskFilter, tasks])

  const filteredNotes = useMemo(() => notes.filter((note) => {
    const subject = subjectMap.get(note.subjectId)?.name ?? 'General'
    return `${note.title} ${note.body} ${subject} ${note.tags.join(' ')}`.toLowerCase().includes(normalizedSearch)
  }), [notes, normalizedSearch, subjectMap])

  const filteredSubjects = useMemo(
    () => subjects.filter((subject) => {
      const percentage = Math.round(calculateSubjectProgress(subject, sessionMinutesMap).percentage)
      // Match the same subject fields as global search (`buildSearchResults`).
      return `${subject.name} ${percentage} ${subject.targetHours}`.toLowerCase().includes(normalizedSearch)
    }),
    [normalizedSearch, sessionMinutesMap, subjects],
  )

  const filteredEvents = useMemo(() => events.filter((event) => {
    const subject = subjectMap.get(event.subjectId)?.name ?? 'General'
    return `${event.title} ${event.location} ${subject}`.toLowerCase().includes(normalizedSearch)
  }), [events, normalizedSearch, subjectMap])

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
  }
}
