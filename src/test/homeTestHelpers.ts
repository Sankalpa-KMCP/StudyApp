import { studyDb } from '../db/studyDb'

export const FIRST_STUDY_TIMESTAMP = '2026-07-13T08:00:00.000Z'

export async function addFirstStudySubject() {
  await studyDb.subjects.add({
    id: 'first-study-subject',
    name: 'Physics',
    color: '#2563eb',
    targetHours: 2,
    progress: 0,
    createdAt: FIRST_STUDY_TIMESTAMP,
    updatedAt: FIRST_STUDY_TIMESTAMP,
  })
}

export async function addFirstStudyEvent() {
  await studyDb.events.add({
    id: 'first-study-event',
    title: 'Practice block',
    subjectId: 'first-study-subject',
    startAt: '2026-07-14T08:00:00.000Z',
    endAt: '2026-07-14T09:00:00.000Z',
    location: '',
    createdAt: FIRST_STUDY_TIMESTAMP,
    updatedAt: FIRST_STUDY_TIMESTAMP,
  })
}

export async function addFirstStudySession() {
  await studyDb.studySessions.add({
    id: 'first-study-session',
    subjectId: 'first-study-subject',
    startedAt: '2026-07-13T08:00:00.000Z',
    endedAt: '2026-07-13T08:30:00.000Z',
    minutes: 30,
    note: 'First study loop',
  })
}
