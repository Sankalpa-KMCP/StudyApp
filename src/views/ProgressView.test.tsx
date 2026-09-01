import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { StudySession, StudySubject, StudyTask } from '../db/types'
import type { WeeklyStudyDay } from '../appUtils'
import { ProgressView } from './ProgressView'

function createSampleMultiDaySessions(numDays: number, sessionsPerDay = 2): StudySession[] {
  const sessions: StudySession[] = []
  for (let d = 0; d < numDays; d++) {
    const year = 2026
    const month = 7 // August
    const day = 20 - d
    for (let s = 0; s < sessionsPerDay; s++) {
      const start = new Date(year, month, day, 10 + (s % 10), Math.floor(s / 10), 0, 0)
      const end = new Date(start.getTime() + 30 * 60_000)
      sessions.push({
        id: `sess-d${d}-s${s}`,
        subjectId: 'sub-math',
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        minutes: 30,
        note: `Session day ${d} slot ${s}`,
      })
    }
  }
  return sessions
}

function createDenseDaySessions(totalSessions: number, year = 2026, month = 7, day = 20): StudySession[] {
  const sessions: StudySession[] = []
  for (let i = 0; i < totalSessions; i++) {
    const second = i % 86400
    const start = new Date(year, month, day, 0, 0, second, 0)
    const end = new Date(start.getTime() + 60_000)
    sessions.push({
      id: `dense-sess-${i}`,
      subjectId: 'sub-math',
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      minutes: 1,
      note: `Dense note ${i}`,
    })
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

describe('ProgressView Hierarchical Two-Dimensional Progressive Bounding (S6.2c)', () => {
  it('bounds initial rendering to at most 50 session rows when 10,000 sessions are on 1 single day', () => {
    const sessions = createDenseDaySessions(10000)
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

    // Exactly 1 day group
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)

    // Initially exactly 50 session rows rendered out of 10,000
    const articles = document.querySelectorAll('.session-row')
    expect(articles).toHaveLength(50)

    // Intra-day disclosure controls are visible
    expect(screen.getByText(/Showing 50 of 10000 sessions for/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show 50 more sessions for/i })).toBeInTheDocument()

    // Day-level footer is NOT shown since totalDays = 1 <= 14
    expect(screen.queryByRole('button', { name: /Show 14 more days/i })).not.toBeInTheDocument()
  })

  it('bounds initial rendering to at most 700 session rows when 10,000 sessions are across 14 visible days', () => {
    const sessions = createSampleMultiDaySessions(14, 714) // 14 days * 714 sessions = 9996 sessions
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

    // 14 day groups rendered
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)

    // Exactly 14 days * 50 sessions/day = 700 session rows rendered initially
    const articles = document.querySelectorAll('.session-row')
    expect(articles).toHaveLength(700)
  })

  it('bounds 15-day adversarial case (9,990 sessions on newest 14 days) to at most 700 initial rows', () => {
    // 14 days with ~714 sessions each + 1 day with 10 sessions = 15 days total
    const sessions14 = createSampleMultiDaySessions(14, 714)
    const sessionsExtra = createSampleMultiDaySessions(1, 10).map((s) => ({
      ...s,
      id: `extra-${s.id}`,
      startedAt: '2026-08-01T10:00:00.000Z',
      endedAt: '2026-08-01T10:30:00.000Z',
    }))
    const allSessions = [...sessions14, ...sessionsExtra]

    render(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={allSessions}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={1}
      />,
    )

    // 14 day groups visible out of 15
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)

    // Exactly 700 session rows visible
    const articles = document.querySelectorAll('.session-row')
    expect(articles).toHaveLength(700)

    // Day-level footer indicates 14 of 15 days
    expect(screen.getByText(/Showing 14 of 15 study days \(700 of 10006 sessions\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 14 more days' })).toBeInTheDocument()
  })

  it('reveals next intra-day batch (+50) on activation for only that day and reaches completion', async () => {
    const user = userEvent.setup()
    const sessions = createDenseDaySessions(120) // 120 sessions on 1 day
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

    // Initial: 50 session rows
    expect(document.querySelectorAll('.session-row')).toHaveLength(50)
    expect(screen.getByText(/Showing 50 of 120 sessions for/i)).toBeInTheDocument()

    // First intra-day click: reveals up to 100
    const intraDayBtn = screen.getByRole('button', { name: /Show 50 more sessions for/i })
    await user.click(intraDayBtn)

    expect(document.querySelectorAll('.session-row')).toHaveLength(100)
    expect(screen.getByText(/Showing 100 of 120 sessions for/i)).toBeInTheDocument()

    // Second intra-day click (final expansion for day): reveals all 120
    const finalIntraBtn = screen.getByRole('button', { name: /Show 50 more sessions for/i })
    await user.click(finalIntraBtn)

    expect(document.querySelectorAll('.session-row')).toHaveLength(120)
    expect(screen.getByText(/Showing all 120 sessions for/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show 50 more sessions for/i })).not.toBeInTheDocument()
  })

  it('safely retains focus on intra-day footer container during final intra-day expansion', async () => {
    const user = userEvent.setup()
    const sessions = createDenseDaySessions(60) // 60 sessions on 1 day
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

    const showMoreBtn = screen.getByRole('button', { name: /Show 50 more sessions for/i })
    showMoreBtn.focus()
    expect(document.activeElement).toBe(showMoreBtn)

    await user.click(showMoreBtn)

    // All 60 are now shown, button is unmounted. Focus must not be on body.
    expect(document.activeElement).not.toBe(document.body)
    const dayFooter = screen.getByText(/Showing all 60 sessions for/i).closest('.session-day-disclosure')
    expect(document.activeElement).toBe(dayFooter)
  })

  it('maintains independent intra-day expansion state across different days', async () => {
    const user = userEvent.setup()
    // 2 days, each with 70 sessions
    const day1Sessions = createDenseDaySessions(70, 2026, 7, 20)
    const day2Sessions = createDenseDaySessions(70, 2026, 7, 19).map((s) => ({
      ...s,
      id: `day2-${s.id}`,
    }))
    const sessions = [...day1Sessions, ...day2Sessions]

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

    // Both days initially show 50 rows each (total 100 rows)
    expect(document.querySelectorAll('.session-row')).toHaveLength(100)

    // Expand only day 1
    const day1Buttons = screen.getAllByRole('button', { name: /Show 50 more sessions for/i })
    expect(day1Buttons).toHaveLength(2)
    await user.click(day1Buttons[0])

    // Day 1 has 70 rows, Day 2 still has 50 rows (total 120 rows)
    expect(document.querySelectorAll('.session-row')).toHaveLength(120)
  })

  it('safely retains focus on macro day footer during final day-level expansion', async () => {
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

    const showMoreDaysBtn = screen.getByRole('button', { name: 'Show 14 more days' })
    showMoreDaysBtn.focus()
    expect(document.activeElement).toBe(showMoreDaysBtn)

    await user.click(showMoreDaysBtn)

    // All 18 days are now shown, button is unmounted. Focus shifted to day-level footer container.
    expect(document.activeElement).not.toBe(document.body)
    const footer = screen.getByText('Showing all 18 study days (36 sessions)').closest('.list-disclosure-footer')
    expect(document.activeElement).toBe(footer)
  })

  it('preserves full-dataset aggregate metrics, summary stats and charts using full session dataset', () => {
    const sessions = createSampleMultiDaySessions(40, 2) // 40 days, 80 sessions
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
    expect(weeklyStudyCard).toHaveTextContent('20h')
    expect(screen.getByText('Tasks complete')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()

    // Charts are visible and accessible
    expect(screen.getByRole('heading', { name: 'Study Time' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subject Distribution' })).toBeInTheDocument()
  })

  it('handles intra-day deletion and day deletion gracefully without blank gaps', () => {
    // 1 dense day of 60 sessions + 1 day of 1 session
    const day1Sessions = createDenseDaySessions(60, 2026, 7, 20)
    const day2Sessions = createDenseDaySessions(1, 2026, 7, 19).map((s) => ({
      ...s,
      id: `day2-${s.id}`,
    }))
    const sessions = [...day1Sessions, ...day2Sessions]

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

    // Day 1 has 50 rows visible, Day 2 has 1 row visible (total 51 rows)
    expect(document.querySelectorAll('.session-row')).toHaveLength(51)

    // Delete session from Day 1
    const remainingDay1 = day1Sessions.slice(1)
    rerender(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={[...remainingDay1, ...day2Sessions]}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={2}
      />,
    )

    // Still 50 rows visible for Day 1 + 1 row for Day 2 = 51 rows total (session 51 moved into view)
    expect(document.querySelectorAll('.session-row')).toHaveLength(51)
    expect(screen.getByText(/Showing 50 of 59 sessions for/i)).toBeInTheDocument()

    // Delete the only session in Day 2
    rerender(
      <ProgressView
        subjects={sampleSubjects}
        tasks={sampleTasks}
        studySessions={remainingDay1}
        weeklyStudyDays={sampleWeeklyDays}
        dailyGoalMinutes={120}
        todayFocusMinutes={60}
        subjectMap={sampleSubjectMap}
        openEditorOnMount={false}
        databaseGeneration={3}
      />,
    )

    // Only 1 day group remains, 50 rows visible
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(document.querySelectorAll('.session-row')).toHaveLength(50)
  })
})
