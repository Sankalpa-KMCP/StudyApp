import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { formatHeroDate, getTimeOfDayGreeting } from './heroDate'
import { HeroRow } from './HeroRow'

describe('formatHeroDate', () => {
  it('formats the supplied local Date for the hero eyebrow', () => {
    expect(formatHeroDate(new Date(2026, 6, 13, 9, 0))).toBe(
      new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(2026, 6, 13, 9, 0)),
    )
    expect(formatHeroDate(new Date(2026, 6, 14, 0, 0))).toBe(
      new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(2026, 6, 14, 0, 0)),
    )
  })
})

describe('getTimeOfDayGreeting', () => {
  it('uses morning before 12:00, afternoon through 17:59, and evening from 18:00', () => {
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 0, 0))).toBe('Good morning')
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 11, 59))).toBe('Good morning')
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 12, 0))).toBe('Good afternoon')
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 17, 59))).toBe('Good afternoon')
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 18, 0))).toBe('Good evening')
    expect(getTimeOfDayGreeting(new Date(2026, 6, 13, 23, 30))).toBe('Good evening')
  })
})

describe('HeroRow', () => {
  it('renders date and greeting from the currentDate prop without module-scoped clock state', () => {
    const currentDate = new Date(2026, 6, 13, 15, 30)
    render(
      <HeroRow
        currentDate={currentDate}
        todayFocusMinutes={30}
        dailyGoalMinutes={120}
        onCreateTask={() => {}}
        onCreateSubject={() => {}}
      />,
    )

    const hero = screen.getByLabelText('Today overview')
    expect(hero).toHaveTextContent(formatHeroDate(currentDate))
    expect(screen.getByRole('heading', { level: 1, name: 'Good afternoon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subject' })).toBeInTheDocument()
  })
})
