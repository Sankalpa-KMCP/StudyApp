import { describe, expect, it } from 'vitest'
import { localDateKey } from '../appUtils'
import type { CalendarEvent, StudyTask } from '../db/types'
import {
  getOpenOverdueTasks,
  getOpenTasksDueToday,
  getTodaysEvents,
  isLocalDateOnlyKey,
} from './dashboardDateHelpers'

const NOW = new Date(2026, 6, 26, 15, 30, 0, 0) // local Sunday Jul 26, 2026
const TODAY = localDateKey(NOW) // 2026-07-26
const YESTERDAY = '2026-07-25'
const TOMORROW = '2026-07-27'

function task(partial: Partial<StudyTask> & Pick<StudyTask, 'id' | 'title'>): StudyTask {
  return {
    subjectId: '',
    dueDate: '',
    priority: 'normal',
    status: 'open',
    minutes: 30,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startAt'>): CalendarEvent {
  return {
    subjectId: '',
    endAt: partial.startAt,
    location: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

describe('dashboardDateHelpers', () => {
  describe('isLocalDateOnlyKey', () => {
    it('accepts real local YYYY-MM-DD keys and rejects empty, malformed, and impossible dates', () => {
      expect(isLocalDateOnlyKey('2026-07-26')).toBe(true)
      expect(isLocalDateOnlyKey('')).toBe(false)
      expect(isLocalDateOnlyKey('2026-7-26')).toBe(false)
      expect(isLocalDateOnlyKey('2026-02-30')).toBe(false)
      expect(isLocalDateOnlyKey('not-a-date')).toBe(false)
      expect(isLocalDateOnlyKey('2026-07-26T12:00:00.000Z')).toBe(false)
    })
  })

  describe('getOpenTasksDueToday', () => {
    it('includes open tasks due today and excludes done, empty, future, past, and malformed due dates', () => {
      const dueToday = task({ id: 't-today', title: 'Today', dueDate: TODAY, createdAt: '2026-07-02T00:00:00.000Z' })
      const doneToday = task({ id: 't-done', title: 'Done today', dueDate: TODAY, status: 'done' })
      const yesterday = task({ id: 't-y', title: 'Yesterday', dueDate: YESTERDAY })
      const tomorrow = task({ id: 't-tom', title: 'Tomorrow', dueDate: TOMORROW })
      const empty = task({ id: 't-empty', title: 'No due', dueDate: '' })
      const malformed = task({ id: 't-bad', title: 'Bad', dueDate: '2026-02-30' })

      expect(getOpenTasksDueToday(
        [yesterday, doneToday, empty, dueToday, tomorrow, malformed],
        NOW,
      )).toEqual([dueToday])
    })

    it('preserves input relative order and does not mutate the source array or task objects', () => {
      const first = task({ id: 'a', title: 'A', dueDate: TODAY, createdAt: '2026-07-01T00:00:00.000Z' })
      const second = task({ id: 'b', title: 'B', dueDate: TODAY, createdAt: '2026-07-02T00:00:00.000Z' })
      const other = task({ id: 'c', title: 'C', dueDate: YESTERDAY })
      const source = [other, first, second]
      const snapshot = source.map((item) => item.id)

      const result = getOpenTasksDueToday(source, NOW)
      expect(result.map((item) => item.id)).toEqual(['a', 'b'])
      expect(result[0]).toBe(first)
      expect(result[1]).toBe(second)
      expect(source.map((item) => item.id)).toEqual(snapshot)
      expect(source[1].dueDate).toBe(TODAY)
    })

    it('compares Task dueDate as a local date-only key without UTC shifting', () => {
      // A UTC-midnight parse of this string can land on the previous local day in western zones;
      // local-key equality must still treat it as Jul 26.
      const due = task({ id: 'local-key', title: 'Local key', dueDate: '2026-07-26' })
      expect(getOpenTasksDueToday([due], new Date(2026, 6, 26, 0, 5))).toEqual([due])
      expect(getOpenTasksDueToday([due], new Date(2026, 6, 25, 23, 55))).toEqual([])
    })
  })

  describe('getOpenOverdueTasks', () => {
    it('includes open tasks due before today and excludes due-today, future, done, empty, and malformed', () => {
      const overdueOlder = task({ id: 'o1', title: 'Older', dueDate: '2026-07-20', createdAt: '2026-07-01T00:00:00.000Z' })
      const overdueYesterday = task({ id: 'o2', title: 'Yesterday', dueDate: YESTERDAY, createdAt: '2026-07-02T00:00:00.000Z' })
      const dueToday = task({ id: 't', title: 'Today', dueDate: TODAY })
      const tomorrow = task({ id: 'f', title: 'Future', dueDate: TOMORROW })
      const doneOverdue = task({ id: 'd', title: 'Done overdue', dueDate: YESTERDAY, status: 'done' })
      const empty = task({ id: 'e', title: 'Empty', dueDate: '' })
      const malformed = task({ id: 'm', title: 'Bad', dueDate: '07/25/2026' })

      expect(getOpenOverdueTasks(
        [dueToday, overdueOlder, doneOverdue, empty, overdueYesterday, tomorrow, malformed],
        NOW,
      )).toEqual([overdueOlder, overdueYesterday])
    })

    it('preserves input relative order for multiple overdue tasks', () => {
      const laterCreated = task({ id: 'late', title: 'Late', dueDate: '2026-07-10', createdAt: '2026-07-05T00:00:00.000Z' })
      const earlierCreated = task({ id: 'early', title: 'Early', dueDate: '2026-07-24', createdAt: '2026-07-01T00:00:00.000Z' })
      const source = [laterCreated, earlierCreated]
      expect(getOpenOverdueTasks(source, NOW).map((item) => item.id)).toEqual(['late', 'early'])
      expect(source.map((item) => item.id)).toEqual(['late', 'early'])
    })
  })

  describe('getTodaysEvents', () => {
    it('includes events on the local day including day start and excludes before/after midnight', () => {
      const dayStart = event({
        id: 'start',
        title: 'Day start',
        startAt: new Date(2026, 6, 26, 0, 0, 0, 0).toISOString(),
      })
      const midDay = event({
        id: 'mid',
        title: 'Mid day',
        startAt: new Date(2026, 6, 26, 14, 15, 0, 0).toISOString(),
      })
      const beforeMidnight = event({
        id: 'before',
        title: 'Before today',
        startAt: new Date(2026, 6, 25, 23, 59, 59, 0).toISOString(),
      })
      const afterMidnight = event({
        id: 'after',
        title: 'After today',
        startAt: new Date(2026, 6, 27, 0, 0, 0, 0).toISOString(),
      })
      const invalid = event({
        id: 'bad',
        title: 'Invalid',
        startAt: 'not-a-timestamp',
      })

      expect(getTodaysEvents(
        [afterMidnight, midDay, invalid, beforeMidnight, dayStart],
        NOW,
      ).map((item) => item.id)).toEqual(['start', 'mid'])
    })

    it('sorts by startAt ascending without mutating the input array', () => {
      const later = event({
        id: 'later',
        title: 'Later',
        startAt: new Date(2026, 6, 26, 18, 0, 0, 0).toISOString(),
      })
      const earlier = event({
        id: 'earlier',
        title: 'Earlier',
        startAt: new Date(2026, 6, 26, 9, 0, 0, 0).toISOString(),
      })
      const source = [later, earlier]
      const result = getTodaysEvents(source, NOW)

      expect(result.map((item) => item.id)).toEqual(['earlier', 'later'])
      expect(result[0]).toBe(earlier)
      expect(result[1]).toBe(later)
      expect(source.map((item) => item.id)).toEqual(['later', 'earlier'])
    })

    it('classifies local midnight boundaries with an injected now', () => {
      const justBefore = event({
        id: 'pre',
        title: 'Pre',
        startAt: new Date(2026, 6, 26, 23, 59, 0, 0).toISOString(),
      })
      const justAfter = event({
        id: 'post',
        title: 'Post',
        startAt: new Date(2026, 6, 27, 0, 0, 0, 0).toISOString(),
      })

      expect(getTodaysEvents([justBefore, justAfter], new Date(2026, 6, 26, 12, 0)).map((e) => e.id)).toEqual(['pre'])
      expect(getTodaysEvents([justBefore, justAfter], new Date(2026, 6, 27, 0, 1)).map((e) => e.id)).toEqual(['post'])
    })
  })
})
