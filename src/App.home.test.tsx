import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { formatHeroDate } from './components/heroDate'
import { getMillisecondsUntilNextLocalMidnight } from './hooks/useCurrentDate'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import {
  addFirstStudyEvent,
  addFirstStudySession,
  addFirstStudySubject,
  FIRST_STUDY_TIMESTAMP,
} from './test/homeTestHelpers'

describe('App home', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('renders an empty database-backed dashboard shell', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Study Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('is-active')
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.queryByText('Chemistry lab report')).not.toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(localStorage.getItem('study-dashboard-theme')).toBe('monochrome')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111111')

    const checklist = screen.getByRole('region', { name: 'Your first study loop' })
    const progress = within(checklist).getByRole('progressbar', { name: 'First study loop progress' })
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuetext', '0 of 3 steps complete')
    expect(within(checklist).getByRole('button', { name: 'Create subject' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Plan task' })).toBeInTheDocument()
    expect(within(checklist).getByRole('button', { name: 'Log session' })).toBeInTheDocument()
  })

  it('keeps a single Home h1 and exposes the topbar label outside the heading outline', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Study Tasks' })).toBeInTheDocument()

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Dashboard')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('derives checklist progress from subjects, tasks or events, and sessions with live updates', async () => {
    await addFirstStudySubject()
    render(<App />)

    const checklist = await screen.findByRole('region', { name: 'Your first study loop' })
    expect(within(checklist).getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute('aria-valuenow', '1')
    expect(within(screen.getByRole('heading', { name: 'Create a subject' }).closest('li')! as HTMLElement).getByText('Complete')).toBeInTheDocument()

    await studyDb.tasks.add({
      id: 'first-study-task',
      title: 'Review chapter one',
      subjectId: 'first-study-subject',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: FIRST_STUDY_TIMESTAMP,
      updatedAt: FIRST_STUDY_TIMESTAMP,
    })
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2'))

    await studyDb.tasks.delete('first-study-task')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Plan task' })).toBeInTheDocument())

    await addFirstStudyEvent()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plan task' })).not.toBeInTheDocument())

    await addFirstStudySession()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument())

    await studyDb.studySessions.delete('first-study-session')
    expect(await screen.findByRole('region', { name: 'Your first study loop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log session' })).toBeInTheDocument()
  })

  it('keeps the checklist hidden for existing users who completed the study loop', async () => {
    await addFirstStudySubject()
    await addFirstStudyEvent()
    await addFirstStudySession()

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your first study loop' })).not.toBeInTheDocument()
  })

  it('opens checklist workflows with native keyboard actions and supported focus', async () => {
    const user = userEvent.setup()
    render(<App />)

    const createSubject = within(await screen.findByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Create subject' })
    createSubject.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Subject name')).toHaveFocus()

    await user.type(screen.getByLabelText('Subject name'), 'Physics')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))

    const planTask = screen.getByRole('button', { name: 'Plan task' })
    planTask.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByLabelText('Task title')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    const logSession = screen.getByRole('button', { name: 'Log session' })
    logSession.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('form', { name: 'Log study session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Log session' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.queryByRole('form', { name: 'Log study session' })).not.toBeInTheDocument()
  })

  it('opens new task and subject editors from the home hero', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = await screen.findByLabelText('Today overview')
    await user.click(within(hero).getByRole('button', { name: 'Task' }))
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(within(screen.getByLabelText('Today overview')).getByRole('button', { name: 'Subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
  })

  it('shows meaningful search results on Home', async () => {
    const user = userEvent.setup()
    await studyDb.subjects.add({
      id: 'subject-search',
      name: 'Biology',
      color: '#0f766e',
      targetHours: 5,
      progress: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    await studyDb.tasks.add({
      id: 'task-search',
      title: 'Cell cycle worksheet',
      subjectId: 'subject-search',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 30,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })

    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'cell')

    expect(await screen.findByRole('heading', { name: 'Search Results' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task: Cell cycle worksheet, Biology - open' })).toBeInTheDocument()
  })

  it('saves quick notes from the home page', async () => {
    render(<App />)

    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)
    fireEvent.change(textarea, { target: { value: 'Review chapter 5 for exam' } })
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    await waitFor(async () => {
      const setting = await studyDb.settings.get('quickNotes')
      expect(Array.isArray(setting?.value) ? setting!.value[0] : setting?.value).toContain('Review chapter 5')
    })
    expect(screen.getByText('Saved locally')).toBeInTheDocument()
  })

  it('preserves quick-note drafts on failure and keeps newest write last', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<App />)
    const textarea = await screen.findByPlaceholderText(/Capture fast ideas/i)

    const originalPut = studyDb.settings.put.bind(studyDb.settings)
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const putSpy = vi.spyOn(studyDb.settings, 'put').mockImplementation(async (entry) => {
      if (entry.key !== 'quickNotes') return originalPut(entry)
      await firstGate
      throw new Error('quick notes write failed')
    })

    fireEvent.change(textarea, { target: { value: 'First draft line' } })
    expect(await screen.findByText('Saving...')).toBeInTheDocument()
    await waitFor(() => expect(putSpy).toHaveBeenCalled())
    releaseFirst()

    expect(await screen.findByRole('alert')).toHaveTextContent('Quick notes could not be saved. Your text is still available.')
    expect(textarea).toHaveValue('First draft line')

    putSpy.mockImplementation(async (entry) => originalPut(entry))
    let olderRelease!: () => void
    let newerRelease!: () => void
    const olderGate = new Promise<void>((resolve) => {
      olderRelease = resolve
    })
    const newerGate = new Promise<void>((resolve) => {
      newerRelease = resolve
    })
    const writes: string[] = []
    putSpy.mockImplementation(async (entry) => {
      if (entry.key !== 'quickNotes') return originalPut(entry)
      const value = Array.isArray(entry.value) ? entry.value.join('\n') : String(entry.value)
      if (value.includes('Older')) {
        await olderGate
      } else {
        await newerGate
      }
      writes.push(value)
      return originalPut(entry)
    })

    fireEvent.change(textarea, { target: { value: 'Older value' } })
    await waitFor(() => expect(putSpy).toHaveBeenCalled())
    fireEvent.change(textarea, { target: { value: 'Newer value' } })
    newerRelease()
    olderRelease()

    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument())
    expect(writes.at(-1)).toContain('Newer value')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['Newer value'])
  })

  it('clears search when no results are found', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    // Navigate to tasks
    await user.click(screen.getByRole('button', { name: 'Tasks' }))

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search')
    await user.type(searchInput, 'nonexistentterm')

    // Click the "Clear search" button that appears in the empty state
    // We should have multiple clear search buttons since we are in a view, let's just click the one in the main area if possible, or any.
    // The Topbar has one, and the empty state has one. The empty state one is usually what users click when there's no results.
    const clearButtons = screen.getAllByRole('button', { name: 'Clear search' })
    await user.click(clearButtons[clearButtons.length - 1])

    expect(searchInput).toHaveValue('')
  })

  it('does not recalculate today metrics before local midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_001 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_001) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await studyDb.studySessions.add({
      id: 'session-before-midnight',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(midnightCallbacks).toHaveLength(1)

    const hero = screen.getByLabelText('Today overview')
    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()

    // Wall clock approaches midnight without firing the rollover callback.
    vi.setSystemTime(new Date(beforeMidnight.getTime() + getMillisecondsUntilNextLocalMidnight(beforeMidnight) - 1))

    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()
  })

  it('recalculates today focus, weekly window, upcoming, and streak after local midnight without mutating data', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const beforeMidnight = new Date(2026, 6, 13, 23, 0, 0, 0)
    vi.setSystemTime(beforeMidnight)

    const midnightCallbacks: Array<() => void> = []
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis)
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler === 'function' && typeof delay === 'number' && delay >= 60_000) {
        midnightCallbacks.push(() => {
          handler(...args)
        })
        return 90_001 as unknown as ReturnType<typeof setTimeout>
      }
      return nativeSetTimeout(handler, delay, ...args)
    }) as typeof setTimeout)
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number | NodeJS.Timeout) => {
      if (id === 90_001) return
      return nativeClearTimeout(id as Parameters<typeof nativeClearTimeout>[0])
    }) as typeof clearTimeout)

    await studyDb.studySessions.add({
      id: 'session-rollover-day',
      subjectId: '',
      startedAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      endedAt: new Date(2026, 6, 13, 10, 45).toISOString(),
      minutes: 45,
      note: '',
    })
    await studyDb.events.add({
      id: 'event-rollover-morning',
      title: 'Morning review',
      subjectId: '',
      startAt: new Date(2026, 6, 13, 9, 0).toISOString(),
      endAt: new Date(2026, 6, 13, 10, 0).toISOString(),
      location: '',
      createdAt: new Date(2026, 6, 13, 8, 0).toISOString(),
      updatedAt: new Date(2026, 6, 13, 8, 0).toISOString(),
    })

    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(midnightCallbacks).toHaveLength(1)

    const hero = screen.getByLabelText('Today overview')
    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    expect(within(hero).getByText('45m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(beforeMidnight))).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good evening' })).toBeInTheDocument()
    expect(within(rightColumn).getByText('Morning review')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('1')).toBeInTheDocument()

    const weeklyBeforeLabels = within(screen.getByRole('region', { name: 'Weekly Progress' }))
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    expect(weeklyBeforeLabels.at(-1)).toHaveTextContent(
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(beforeMidnight),
    )

    const sessionCountBefore = await studyDb.studySessions.count()
    const eventCountBefore = await studyDb.events.count()

    const afterMidnight = new Date(2026, 6, 14, 0, 0, 0, 0)
    vi.setSystemTime(afterMidnight)
    await act(async () => {
      midnightCallbacks[0]!()
    })

    expect(within(hero).getByText('0m')).toBeInTheDocument()
    expect(within(hero).getByText(formatHeroDate(afterMidnight))).toBeInTheDocument()
    expect(within(hero).queryByText(formatHeroDate(beforeMidnight))).not.toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 1, name: 'Good morning' })).toBeInTheDocument()
    expect(within(rightColumn).queryByText('Morning review')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Streak' })).getByText('0')).toBeInTheDocument()

    const weeklyAfterLabels = within(screen.getByRole('region', { name: 'Weekly Progress' }))
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    expect(weeklyAfterLabels.at(-1)).toHaveTextContent(
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(afterMidnight),
    )

    expect(await studyDb.studySessions.count()).toBe(sessionCountBefore)
    expect(await studyDb.events.count()).toBe(eventCountBefore)
  })

  it('exposes the weekly progress bar chart as a named non-interactive image', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Weekly Progress' })).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: 'Weekly progress by day' })
    expect(chart).toHaveClass('bar-chart')
    expect(chart).not.toHaveAttribute('tabindex')
    expect(chart.tabIndex).toBeLessThan(0)
    expect(within(chart).queryByRole('button')).not.toBeInTheDocument()
    expect(document.querySelector('.bar-days')).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes the Study Time line chart as a named non-interactive image', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Study Time' })).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: 'Study time trend' })
    expect(chart).toHaveClass('line-chart')
    expect(chart).not.toHaveAttribute('tabindex')
    expect(chart.tabIndex).toBeLessThan(0)
    expect(within(chart).queryByRole('button')).not.toBeInTheDocument()
    expect(within(chart).queryByRole('img')).not.toBeInTheDocument()
    expect(chart.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.line-days')).toHaveAttribute('aria-hidden', 'true')
  })
})
