import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { StudySession, StudySubject, StudyTask } from '../db/types'
import type { WeeklyStudyDay } from '../appUtils'
import { ProgressView } from './ProgressView'

function createSampleMultiDaySessions(numDays: number, sessionsPerDay = 2): StudySession[] {
  const sessions: StudySession[] = []
  for (let d = 0; d < numDays; d++) {
    // Generate dates: day 0 is 2026-08-20, day 1 is 2026-08-19, etc.
    const year = 2026
    const month = 7 // August (0-indexed 7)
    const day = 20 - d
    for (let s = 0; s < sessionsPerDay; s++) {
      const start = new Date(year, month, day, 10 + s * 2, 0, 0, 0)
      const end = new Date(year, month, day, 11 + s * 2, 0, 0, 0)
      sessions.push({
        id: `sess-d${d}-s${s}`,
        subjectId: 'sub-math',
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        minutes: 60,
        note: `Session day ${d} slot ${s}`,
      })
    }
  }
  return sessions
}

const sampleSubjects: StudySubject[] = [
  {
    id: 'sub-math',
    name: 'Mathematics',
    color: '#2563eb',
    targetHours: 50,
    progress: 25,
    progressMode: 'study_time',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const sampleSubjectMap = new Map(sampleSubjects.map((s) => [s.id, s]))

const sampleTasks: StudyTask[] = [
  {
    id: 'task-1',
    title: 'Review Chapter 4',
    subjectId: 'sub-math',
    dueDate: '2026-09-01',
    priority: 'high',
    status: 'done',
    minutes: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const sampleWeeklyDays: WeeklyStudyDay[] = [
  { key: '2026-08-14', label: 'Fri', hours: 2 },
  { key: '2026-08-15', label: 'Sat', hours: 3 },
  { key: '2026-08-16', label: 'Sun', hours: 1 },
  { key: '2026-08-17', label: 'Mon', hours: 4 },
  { key: '2026-08-18', label: 'Tue', hours: 2 },
  { key: '2026-08-19', label: 'Wed', hours: 3 },
  { key: '2026-08-20', label: 'Thu', hours: 5 },
]

describe('ProgressView Day-Group Progressive Bounding (S6.2b)', () => {
  it('renders at most 14 complete day groups initially when dataset exceeds 14 days', () => {
    const sessions = createSampleMultiDaySessions(30, 2) // 30 days, 60 sessions
    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    // Heading elements for day groups (h3 elements in .session-day-heading)
    const dayHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(dayHeadings).toHaveLength(14)

    // Verify all sessions in those 14 days are rendered (14 days * 2 sessions = 28 session articles)
    expect(screen.getByText('Showing 14 of 30 study days (28 of 60 sessions)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 14 more days' })).toBeInTheDocument()
  })

  it('renders all day groups without disclosure footer when dataset has <= 14 days', () => {
    const sessions = createSampleMultiDaySessions(8, 2) // 8 days, 16 sessions
    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    const dayHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(dayHeadings).toHaveLength(8)
    expect(screen.queryByRole('button', { name: /Show .* more days/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing .* of .* study days/i)).not.toBeInTheDocument()
  })

  it('reveals next batch (+14 days) on activation and expands progressively through final records', async () => {
    const user = userEvent.setup()
    const sessions = createSampleMultiDaySessions(35, 2) // 35 days, 70 sessions
    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    // Initial: 14 days, 28 sessions
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)

    // First click: reveals up to 28 days (56 sessions)
    await user.click(screen.getByRole('button', { name: 'Show 14 more days' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(28)
    expect(screen.getByText('Showing 28 of 35 study days (56 of 70 sessions)')).toBeInTheDocument()

    // Second click (final expansion): reveals all 35 days (70 sessions)
    await user.click(screen.getByRole('button', { name: 'Show 14 more days' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(35)
    expect(screen.getByText('Showing all 35 study days (70 sessions)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show .* more days/i })).not.toBeInTheDocument()
  })

  it('safely retains focus on list footer during final expansion without losing focus to body', async () => {
    const user = userEvent.setup()
    const sessions = createSampleMultiDaySessions(18, 2) // 18 days
    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    const showMoreBtn = screen.getByRole('button', { name: 'Show 14 more days' })
    showMoreBtn.focus()
    expect(document.activeElement).toBe(showMoreBtn)

    await user.click(showMoreBtn)

    // All 18 days are now shown, button is unmounted. Focus shifted to footer container.
    expect(document.activeElement).not.toBe(document.body)
    const footer = screen.getByText('Showing all 18 study days (36 sessions)').closest('.list-disclosure-footer')
    expect(document.activeElement).toBe(footer)
  })

  it('preserves aggregate metrics, summary stats and charts using full session dataset', () => {
    const sessions = createSampleMultiDaySessions(40, 2) // 40 days, 80 hours total
    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    // Header session count stat reports ALL 80 sessions
    expect(screen.getByText('80 sessions logged')).toBeInTheDocument()

    // Metric cards report full data
    const weeklyStudyCard = screen.getByText('Weekly study').closest('.metric-card')
    expect(weeklyStudyCard).toHaveTextContent('20h') // sum of sampleWeeklyDays = 2+3+1+4+2+3+5 = 20h
    expect(screen.getByText('Tasks complete')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()

    // Charts are visible and accessible
    expect(screen.getByRole('heading', { name: 'Study Time' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subject Distribution' })).toBeInTheDocument()
  })

  it('handles deletion of a session and full day cleanly without gaps', () => {
    const sessions = createSampleMultiDaySessions(20, 1) // 20 days, 1 session each

    const { rerender } = render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={sessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    // Initially 14 days rendered
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)
    expect(screen.getByText('Showing 14 of 20 study days (14 of 20 sessions)')).toBeInTheDocument()

    // Delete day 0 session (sess-d0-s0)
    const remainingSessions = sessions.filter((s) => s.id !== 'sess-d0-s0')
    rerender(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={remainingSessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={2}
      />,
    )

    // 14 days still rendered (day 14 has moved into the 14th visible slot)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)
    expect(screen.getByText('Showing 14 of 19 study days (14 of 19 sessions)')).toBeInTheDocument()
  })
})
