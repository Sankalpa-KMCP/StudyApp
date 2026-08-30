import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE_FOCUS_SESSION_KEY } from './activeFocusSession'
import {
  createSubject,
  deleteSubject,
  getSubjectLinkedUsage,
  updateSubject,
} from './subjectService'
import { studyDb } from './studyDb'
import type { ActiveFocusSession } from './types'

describe('subjectService', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('creates a subject with generated id and matching timestamps', async () => {
    const created = await createSubject({
      name: 'Physics',
      color: '#2563eb',
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
    })

    expect(created.id).toMatch(/^subject-/)
    expect(created).toMatchObject({
      name: 'Physics',
      color: '#2563eb',
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
    })
    expect(created.createdAt).toBe(created.updatedAt)
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    expect(await studyDb.subjects.get(created.id)).toEqual(created)
  })

  it('updates editable fields and refreshes updatedAt while preserving createdAt', async () => {
    const original = await createSubject({
      name: 'Original',
      color: '#111827',
      targetHours: 4,
      progress: 10,
      progressMode: 'manual',
    })

    await updateSubject(original.id, {
      name: 'Renamed',
      color: '#0f766e',
      targetHours: 8,
      progress: 35,
      progressMode: 'study_time',
    })

    const stored = await studyDb.subjects.get(original.id)
    expect(stored).toMatchObject({
      id: original.id,
      name: 'Renamed',
      color: '#0f766e',
      targetHours: 8,
      progress: 35,
      progressMode: 'study_time',
      createdAt: original.createdAt,
    })
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(original.createdAt))
  })

  it('throws when updating a missing subject', async () => {
    await expect(updateSubject('subject-missing', {
      name: 'Gone',
      color: '#111827',
      targetHours: 1,
      progress: 0,
      progressMode: 'manual',
    })).rejects.toThrow('Subject no longer exists.')
  })

  it('reports zero linked usage for an unreferenced subject', async () => {
    const created = await createSubject({
      name: 'Unlinked',
      color: '#111827',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
    })

    expect(await getSubjectLinkedUsage(created.id)).toEqual({
      tasks: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      activeFocus: 0,
    })
  })

  it('counts linked records across every protected related table', async () => {
    const created = await createSubject({
      name: 'Linked',
      color: '#b45309',
      targetHours: 4,
      progress: 0,
      progressMode: 'manual',
    })
    const timestamp = '2026-06-29T00:00:00.000Z'
    const subjectId = created.id

    await studyDb.tasks.add({
      id: 'task-1',
      title: 'Task',
      subjectId,
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.notes.bulkAdd([
      {
        id: 'note-1',
        title: 'Note A',
        body: 'Body',
        subjectId,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'note-2',
        title: 'Note B',
        body: 'Body',
        subjectId,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    await studyDb.events.add({
      id: 'event-1',
      title: 'Event',
      subjectId,
      startAt: '2026-08-01T09:00:00.000Z',
      endAt: '2026-08-01T10:00:00.000Z',
      location: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await studyDb.studySessions.bulkAdd([
      {
        id: 'session-1',
        subjectId,
        startedAt: '2026-08-01T09:00:00.000Z',
        endedAt: '2026-08-01T09:30:00.000Z',
        minutes: 30,
        note: '',
      },
      {
        id: 'session-2',
        subjectId,
        startedAt: '2026-08-02T09:00:00.000Z',
        endedAt: '2026-08-02T10:00:00.000Z',
        minutes: 60,
        note: '',
      },
      {
        id: 'session-3',
        subjectId,
        startedAt: '2026-08-03T09:00:00.000Z',
        endedAt: '2026-08-03T09:45:00.000Z',
        minutes: 45,
        note: '',
      },
    ])

    // Unrelated subject rows must not inflate counts.
    await studyDb.notes.add({
      id: 'note-other',
      title: 'Other',
      body: 'Other',
      subjectId: 'subject-other',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    expect(await getSubjectLinkedUsage(subjectId)).toEqual({
      tasks: 1,
      notes: 2,
      events: 1,
      sessions: 3,
      activeFocus: 0,
    })
  })

  it('reports activeFocus: 1 when active focus session references the subject', async () => {
    const created = await createSubject({
      name: 'Active Subject',
      color: '#10b981',
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
    })
    const focusSession: ActiveFocusSession = {
      id: 'focus-active-1',
      subjectId: created.id,
      startedAt: '2026-08-22T10:00:00.000Z',
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: focusSession })

    expect(await getSubjectLinkedUsage(created.id)).toEqual({
      tasks: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      activeFocus: 1,
    })
  })

  it('reports activeFocus: 0 for General focus, other subjects, or invalid settings', async () => {
    const subjectA = await createSubject({
      name: 'Subject A',
      color: '#10b981',
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
    })
    const subjectB = await createSubject({
      name: 'Subject B',
      color: '#3b82f6',
      targetHours: 5,
      progress: 0,
      progressMode: 'manual',
    })

    // General focus
    await studyDb.settings.put({
      key: ACTIVE_FOCUS_SESSION_KEY,
      value: {
        id: 'focus-gen',
        subjectId: '',
        startedAt: '2026-08-22T10:00:00.000Z',
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })
    expect((await getSubjectLinkedUsage(subjectA.id)).activeFocus).toBe(0)

    // Focus on Subject B
    await studyDb.settings.put({
      key: ACTIVE_FOCUS_SESSION_KEY,
      value: {
        id: 'focus-b',
        subjectId: subjectB.id,
        startedAt: '2026-08-22T10:00:00.000Z',
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })
    expect((await getSubjectLinkedUsage(subjectA.id)).activeFocus).toBe(0)
    expect((await getSubjectLinkedUsage(subjectB.id)).activeFocus).toBe(1)
  })

  it('deletes an existing unlinked subject and returns ok: true', async () => {
    const created = await createSubject({
      name: 'Temporary',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    })

    const result = await deleteSubject(created.id)
    expect(result).toEqual({ ok: true })
    expect(await studyDb.subjects.get(created.id)).toBeUndefined()
  })

  it('treats deleting a missing subject as idempotent success', async () => {
    const result = await deleteSubject('subject-already-gone')
    expect(result).toEqual({ ok: true })
    expect(await studyDb.subjects.count()).toBe(0)
  })

  it('blocks deletion when active focus session references the subject and leaves row intact', async () => {
    const created = await createSubject({
      name: 'Focus Protected',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    })
    const focusSession: ActiveFocusSession = {
      id: 'focus-block-1',
      subjectId: created.id,
      startedAt: '2026-08-22T10:00:00.000Z',
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }
    await studyDb.settings.put({ key: ACTIVE_FOCUS_SESSION_KEY, value: focusSession })

    const result = await deleteSubject(created.id)
    expect(result).toEqual({
      ok: false,
      reason: 'linked',
      usage: {
        tasks: 0,
        notes: 0,
        events: 0,
        sessions: 0,
        activeFocus: 1,
      },
    })
    expect(await studyDb.subjects.get(created.id)).toBeDefined()
  })

  it('blocks deletion when linked tasks, notes, events, or sessions exist', async () => {
    const created = await createSubject({
      name: 'Multi-linked',
      color: '#111827',
      targetHours: 2,
      progress: 0,
      progressMode: 'manual',
    })
    await studyDb.tasks.add({
      id: 'task-test-link',
      title: 'Task Link',
      subjectId: created.id,
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 15,
      createdAt: '2026-08-22T10:00:00.000Z',
      updatedAt: '2026-08-22T10:00:00.000Z',
    })

    const result = await deleteSubject(created.id)
    expect(result).toEqual({
      ok: false,
      reason: 'linked',
      usage: {
        tasks: 1,
        notes: 0,
        events: 0,
        sessions: 0,
        activeFocus: 0,
      },
    })
    expect(await studyDb.subjects.get(created.id)).toBeDefined()
  })

  it('protects against TOCTOU race: blocks deletion if link created after preliminary check', async () => {
    const created = await createSubject({
      name: 'Race Subject',
      color: '#ec4899',
      targetHours: 3,
      progress: 0,
      progressMode: 'manual',
    })

    // Preliminary check says 0 linked records (dialog would open)
    const preliminaryCheck = await getSubjectLinkedUsage(created.id)
    expect(preliminaryCheck).toEqual({
      tasks: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      activeFocus: 0,
    })

    // Concurrently or in another tab, an active focus session is started
    await studyDb.settings.put({
      key: ACTIVE_FOCUS_SESSION_KEY,
      value: {
        id: 'focus-race-1',
        subjectId: created.id,
        startedAt: '2026-08-22T10:00:00.000Z',
        plannedMinutes: 25,
        status: 'running',
        pausedAt: null,
        accumulatedPausedMs: 0,
      },
    })

    // User clicks confirm delete; authoritative deleteSubject transaction catches the link
    const result = await deleteSubject(created.id)
    expect(result).toEqual({
      ok: false,
      reason: 'linked',
      usage: {
        tasks: 0,
        notes: 0,
        events: 0,
        sessions: 0,
        activeFocus: 1,
      },
    })
    expect(await studyDb.subjects.get(created.id)).toBeDefined()
  })
})
