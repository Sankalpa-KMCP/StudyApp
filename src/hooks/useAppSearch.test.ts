import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StudyData } from '../db/types'
import { useAppSearch } from './useAppSearch'

const EMPTY_DATA: StudyData = {
  tasks: [],
  subjects: [],
  notes: [],
  events: [],
  flashcards: [],
  studySessions: [],
  goals: [],
  settings: [],
}

function makeFixtureData(): StudyData {
  return {
    ...EMPTY_DATA,
    subjects: [
      {
        id: 'subject-math',
        name: 'Mathematics',
        color: '#2563eb',
        targetHours: 4,
        progress: 40,
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        id: 'subject-bio',
        name: 'Biology',
        color: '#0f766e',
        targetHours: 3,
        progress: 10,
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
    flashcards: [
      {
        id: 'card-due',
        subjectId: 'subject-math',
        front: 'Derivative of x^2',
        back: '2x',
        status: 'learning',
        dueAt: '2020-01-01T00:00:00.000Z',
        lastReviewedAt: '',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
      {
        id: 'card-later',
        subjectId: 'subject-bio',
        front: 'Mitochondria',
        back: 'Powerhouse',
        status: 'new',
        dueAt: '2099-01-01T00:00:00.000Z',
        lastReviewedAt: '',
        createdAt: '2026-06-29T00:00:00.000Z',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    ],
  }
}

describe('useAppSearch', () => {
  it('exposes deferred search and clears the input state', () => {
    const data = makeFixtureData()
    const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ data, subjectMap, taskFilter: 'all' }))

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
    const data = makeFixtureData()
    const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]))
    const { result, rerender } = renderHook(
      ({ taskFilter }: { taskFilter: 'all' | 'open' | 'done' }) => useAppSearch({ data, subjectMap, taskFilter }),
      { initialProps: { taskFilter: 'all' as const } },
    )

    act(() => {
      result.current.setSearch('math')
    })

    expect(result.current.filteredTasks.map((task) => task.id)).toEqual(['task-open'])
    expect(result.current.filteredNotes.map((note) => note.id)).toEqual(['note-1'])
    expect(result.current.filteredSubjects.map((subject) => subject.id)).toEqual(['subject-math'])
    expect(result.current.filteredEvents.map((event) => event.id)).toEqual(['event-1'])
    expect(result.current.filteredFlashcards.map((card) => card.id)).toEqual(['card-due'])

    rerender({ taskFilter: 'done' })
    expect(result.current.filteredTasks).toEqual([])

    act(() => {
      result.current.setSearch('cell')
    })
    expect(result.current.filteredTasks.map((task) => task.id)).toEqual(['task-done'])
  })

  it('sorts filtered flashcards with due cards first', () => {
    const data = makeFixtureData()
    const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ data, subjectMap, taskFilter: 'all' }))

    expect(result.current.filteredFlashcards.map((card) => card.id)).toEqual(['card-due', 'card-later'])
  })

  it('derives Home results through buildSearchResults with the existing cap', () => {
    const data = makeFixtureData()
    for (let index = 0; index < 10; index += 1) {
      data.tasks.push({
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
    const subjectMap = new Map(data.subjects.map((subject) => [subject.id, subject]))
    const { result } = renderHook(() => useAppSearch({ data, subjectMap, taskFilter: 'all' }))

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
})
