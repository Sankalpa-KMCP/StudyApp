import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent, StudyNote, StudySession, StudySubject, StudyTask } from '../db/types'
import { useAppSearch } from './useAppSearch'

function makeFixture(): {
  subjects: StudySubject[]
  notes: StudyNote[]
  events: CalendarEvent[]
  tasks: StudyTask[]
  studySessions: StudySession[]
} {
  return {
    subjects: [
      {
        id: 'subject-math',
        name: 'Mathematics',
        color: '#2563eb',
        targetHours: 4,
        progress: 40,
        progressMode: 'manual',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        id: 'subject-bio',
        name: 'Biology',
        color: '#0f766e',
        targetHours: 3,
        progress: 10,
        progressMode: 'manual',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: 'task-open',
        title: 'Derivatives drill',
        subjectId: 'subject-math',
        dueDate: '2026-07-01',
        priority: 'high',
        status: 'open',
        minutes: 30,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        id: 'task-done',
        title: 'Cell diagrams',
        subjectId: 'subject-bio',
        dueDate: '2026-07-01',
        priority: 'normal',
        status: 'done',
        minutes: 20,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Limit rules',
        body: 'Squeeze theorem notes',
        subjectId: 'subject-math',
        tags: ['calculus'],
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
    events: [
      {
        id: 'event-1',
        title: 'Math clinic',
        location: 'Library',
        subjectId: 'subject-math',
        startAt: '2026-07-02T10:00:00.000Z',
        endAt: '2026-07-02T11:00:00.000Z',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
    studySessions: [],
  }
}

describe('useAppSearch', () => {
  it('exposes deferred search and clears the input state', () => {
    const { subjects, notes, events, tasks, studySessions } = makeFixture()
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter: 'all' }))

    expect(result.current.search).toBe('')
    expect(result.current.deferredSearch).toBe('')

    act(() => {
      result.current.setSearch('calculus')
    })

    expect(result.current.search).toBe('calculus')
    expect(result.current.deferredSearch).toBe('calculus')

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.search).toBe('')
    expect(result.current.deferredSearch).toBe('')
  })

  it('filters workspace collections with current search and task-status semantics', () => {
    const { subjects, notes, events, tasks, studySessions } = makeFixture()
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
    const { result, rerender } = renderHook(
      ({ taskFilter }: { taskFilter: 'all' | 'open' | 'done' }) => useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter }),
      { initialProps: { taskFilter: 'all' as const } },
    )

    act(() => {
      result.current.setSearch('math')
    })

    expect(result.current.filteredTasks.map((task) => task.id)).toEqual(['task-open'])
    expect(result.current.filteredNotes.map((note) => note.id)).toEqual(['note-1'])
    expect(result.current.filteredSubjects.map((subject) => subject.id)).toEqual(['subject-math'])
    expect(result.current.filteredEvents.map((event) => event.id)).toEqual(['event-1'])

    rerender({ taskFilter: 'done' })
    expect(result.current.filteredTasks).toEqual([])

    act(() => {
      result.current.setSearch('cell')
    })
    expect(result.current.filteredTasks.map((task) => task.id)).toEqual(['task-done'])
  })

  it('filters and labels subjects using calculated progress instead of stale stored progress', () => {
    const fixture = makeFixture()
    const { subjects, notes, events, tasks } = fixture
    subjects[0] = {
      ...subjects[0],
      progress: 40,
      progressMode: 'study_time',
      targetHours: 2,
    }
    const studySessions: StudySession[] = [
      {
        id: 'session-math',
        subjectId: 'subject-math',
        startedAt: '2026-06-29T09:00:00.000Z',
        endedAt: '2026-06-29T10:00:00.000Z',
        minutes: 60,
        note: 'Practice',
      },
    ]
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter: 'all' }))

    act(() => {
      result.current.setSearch('50')
    })
    expect(result.current.filteredSubjects.map((subject) => subject.id)).toEqual(['subject-math'])

    act(() => {
      result.current.setSearch('40')
    })
    expect(result.current.filteredSubjects).toEqual([])

    act(() => {
      result.current.setSearch('Mathematics')
    })
    expect(result.current.homeSearchResults).toContainEqual({
      id: 'subject-math',
      type: 'Subject',
      title: 'Mathematics',
      meta: '50% progress',
      view: 'Subjects',
    })
  })

  it('derives Home results through buildSearchResults with the existing cap', () => {
    const { subjects, notes, events, tasks, studySessions } = makeFixture()
    for (let index = 0; index < 10; index += 1) {
      tasks.push({
        id: `task-extra-${index}`,
        title: `Searchable task ${index}`,
        subjectId: 'subject-math',
        dueDate: '2026-07-01',
        priority: 'low',
        status: 'open',
        minutes: 10,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      })
    }
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter: 'all' }))

    expect(result.current.homeSearchResults).toEqual([])

    act(() => {
      result.current.setSearch('searchable')
    })

    expect(result.current.homeSearchResults).toHaveLength(8)
    expect(result.current.homeSearchResults.every((item) => item.type === 'Task')).toBe(true)
    expect(result.current.homeSearchResults[0]).toMatchObject({
      type: 'Task',
      meta: expect.stringContaining('Mathematics'),
      view: 'Tasks',
    })
  })

  it('dynamically recalculates subject search results when studySessions change', () => {
    const { subjects, notes, events, tasks } = makeFixture()
    subjects[0] = { ...subjects[0], progressMode: 'study_time', targetHours: 2 }
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))

    const initialSessions: StudySession[] = []
    const { result, rerender } = renderHook(
      ({ studySessions }) => useAppSearch({ subjects, notes, events, tasks, studySessions, subjectMap, taskFilter: 'all' }),
      { initialProps: { studySessions: initialSessions } },
    )

    act(() => {
      result.current.setSearch('Mathematics')
    })
    const subjectResultBefore = result.current.homeSearchResults.find((item) => item.type === 'Subject')
    expect(subjectResultBefore).toMatchObject({
      title: 'Mathematics',
      meta: '0% progress',
    })

    // Add session: 60m / 120m = 50%
    const updatedSessions: StudySession[] = [
      { id: 's1', subjectId: 'subject-math', startedAt: '2026-06-29T09:00:00.000Z', endedAt: '2026-06-29T10:00:00.000Z', minutes: 60, note: '' },
    ]
    rerender({ studySessions: updatedSessions })

    const subjectResultAfter = result.current.homeSearchResults.find((item) => item.type === 'Subject')
    expect(subjectResultAfter).toMatchObject({
      title: 'Mathematics',
      meta: '50% progress',
    })
  })
})
