import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart, StreakCard, StudyTime, SubjectDistribution, Upcoming, WeeklyProgress } from './RightColumn'
import type { WeeklyStudyDay } from '../appUtils'
import type { StudySession, StudySubject } from '../db/types'

describe('RightColumn Charts Accessibility (F-16)', () => {
  const sampleDays: WeeklyStudyDay[] = [
    { key: '2026-08-20', label: 'Thu', hours: 0 },
    { key: '2026-08-21', label: 'Fri', hours: 1.5 },
    { key: '2026-08-22', label: 'Sat', hours: 0 },
    { key: '2026-08-23', label: 'Sun', hours: 2 },
    { key: '2026-08-24', label: 'Mon', hours: 0.75 },
    { key: '2026-08-25', label: 'Tue', hours: 0 },
    { key: '2026-08-26', label: 'Wed', hours: 3 },
  ]

  describe('BarChart (WeeklyProgress)', () => {
    it('exposes accurate day and value breakdown in its accessible name', () => {
      render(<BarChart days={sampleDays} />)

      const expectedLabel = 'Weekly progress by day: Thu 0h, Fri 1h 30m, Sat 0h, Sun 2h, Mon 0h 45m, Tue 0h, Wed 3h.'
      const chart = screen.getByRole('img', { name: expectedLabel })
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveClass('bar-chart')

      // Visual day labels below bars remain aria-hidden to prevent redundant announcements
      const dayLabels = document.querySelector('.bar-days')
      expect(dayLabels).toHaveAttribute('aria-hidden', 'true')
    })

    it('updates accessible label dynamically when day data changes', () => {
      const { rerender } = render(<BarChart days={sampleDays} />)
      expect(screen.getByRole('img', { name: /Fri 1h 30m/ })).toBeInTheDocument()

      const updatedDays: WeeklyStudyDay[] = [
        ...sampleDays.slice(0, 1),
        { key: '2026-08-21', label: 'Fri', hours: 4 },
        ...sampleDays.slice(2),
      ]
      rerender(<BarChart days={updatedDays} />)

      expect(screen.getByRole('img', { name: /Fri 4h/ })).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /Fri 1h 30m/ })).not.toBeInTheDocument()
    })

    it('handles empty day lists gracefully', () => {
      render(<BarChart days={[]} />)
      expect(screen.getByRole('img', { name: 'Weekly progress by day: No days recorded.' })).toBeInTheDocument()
    })

    it('renders WeeklyProgress card containing total stat and accessible BarChart', () => {
      render(<WeeklyProgress days={sampleDays} />)
      expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
      expect(screen.getByText('7h 15m')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /Weekly progress by day:/ })).toBeInTheDocument()
    })
  })

  describe('StudyTime (Line Chart)', () => {
    it('exposes accurate day and value breakdown in its accessible name', () => {
      render(<StudyTime days={sampleDays} />)

      const expectedLabel = 'Study time trend: Thu 0h, Fri 1h 30m, Sat 0h, Sun 2h, Mon 0h 45m, Tue 0h, Wed 3h.'
      const chart = screen.getByRole('img', { name: expectedLabel })
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveClass('line-chart')

      // SVG polyline and dots remain aria-hidden
      const svg = chart.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')

      // Line days container remains aria-hidden
      const lineDays = chart.querySelector('.line-days')
      expect(lineDays).toHaveAttribute('aria-hidden', 'true')
    })

    it('updates accessible label dynamically when study days change', () => {
      const { rerender } = render(<StudyTime days={sampleDays} />)
      expect(screen.getByRole('img', { name: /Wed 3h/ })).toBeInTheDocument()

      const zeroDays = sampleDays.map((d) => ({ ...d, hours: 0 }))
      rerender(<StudyTime days={zeroDays} />)

      const expectedZeroLabel = 'Study time trend: Thu 0h, Fri 0h, Sat 0h, Sun 0h, Mon 0h, Tue 0h, Wed 0h.'
      expect(screen.getByRole('img', { name: expectedZeroLabel })).toBeInTheDocument()
    })

    it('handles empty day lists gracefully', () => {
      render(<StudyTime days={[]} />)
      expect(screen.getByRole('img', { name: 'Study time trend: No days recorded.' })).toBeInTheDocument()
    })
  })

  describe('Other RightColumn components', () => {
    it('renders Upcoming section and EmptyState when no events', () => {
      render(<Upcoming events={[]} subjectMap={new Map()} onViewAll={() => undefined} />)
      expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
      expect(screen.getByText('No upcoming events')).toBeInTheDocument()
    })

    it('renders StreakCard with streak value', () => {
      const sessions: StudySession[] = [
        {
          id: 's1',
          subjectId: '',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          minutes: 45,
        },
      ]
      render(<StreakCard sessions={sessions} />)
      expect(screen.getByRole('heading', { name: 'Streak' })).toBeInTheDocument()
      expect(screen.getByText('days with logged study')).toBeInTheDocument()
    })

    it('renders SubjectDistribution with progressbars when study minutes exist', () => {
      const subjects: StudySubject[] = [{ id: 'sub-1', name: 'Math', color: '#1556c0', progress: 50, targetHours: 10, progressMode: 'study_time' }]
      const sessions: StudySession[] = [
        { id: 's1', subjectId: 'sub-1', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), minutes: 60 },
      ]
      const subjectMap = new Map([['sub-1', subjects[0]]])
      render(<SubjectDistribution subjects={subjects} sessions={sessions} subjectMap={subjectMap} />)

      expect(screen.getByRole('heading', { name: 'Subject Distribution' })).toBeInTheDocument()
      const progress = screen.getByRole('progressbar', { name: 'Math - 1h' })
      expect(progress).toHaveAttribute('aria-valuenow', '100')
    })

    it('renders SubjectDistribution with multiple subjects and calculates proportions accurately', () => {
      const subjects: StudySubject[] = [
        { id: 'sub-1', name: 'Math', color: '#1556c0', progress: 0, targetHours: 10, progressMode: 'study_time' },
        { id: 'sub-2', name: 'Physics', color: '#334155', progress: 0, targetHours: 10, progressMode: 'study_time' },
        { id: 'sub-3', name: 'Biology', color: '#047857', progress: 0, targetHours: 10, progressMode: 'manual' },
      ]
      const sessions: StudySession[] = [
        { id: 's1', subjectId: 'sub-1', startedAt: '2026-08-26T10:00:00.000Z', endedAt: '2026-08-26T11:00:00.000Z', minutes: 60 },
        { id: 's2', subjectId: 'sub-2', startedAt: '2026-08-26T11:00:00.000Z', endedAt: '2026-08-26T13:00:00.000Z', minutes: 120 },
        { id: 's3', subjectId: 'orphaned', startedAt: '2026-08-26T14:00:00.000Z', endedAt: '2026-08-26T14:20:00.000Z', minutes: 20 },
      ]
      const subjectMap = new Map(subjects.map((s) => [s.id, s]))
      render(<SubjectDistribution subjects={subjects} sessions={sessions} subjectMap={subjectMap} />)

      // Total session minutes = 60 + 120 + 20 = 200 min
      // Math: 60/200 = 30%
      // Physics: 120/200 = 60%
      // Biology: 0/200 = 0%
      const mathBar = screen.getByRole('progressbar', { name: 'Math - 1h' })
      expect(mathBar).toHaveAttribute('aria-valuenow', '30')

      const physicsBar = screen.getByRole('progressbar', { name: 'Physics - 2h' })
      expect(physicsBar).toHaveAttribute('aria-valuenow', '60')

      const bioBar = screen.getByRole('progressbar', { name: 'Biology - 0m' })
      expect(bioBar).toHaveAttribute('aria-valuenow', '0')
    })

    it('renders empty prompt when all sessions have zero logged minutes', () => {
      const subjects: StudySubject[] = [{ id: 'sub-1', name: 'Math', color: '#1556c0', progress: 50, targetHours: 10, progressMode: 'study_time' }]
      const subjectMap = new Map([['sub-1', subjects[0]]])
      render(<SubjectDistribution subjects={subjects} sessions={[]} subjectMap={subjectMap} />)

      expect(screen.getByText('Log study sessions to see where your time is going.')).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })
})
