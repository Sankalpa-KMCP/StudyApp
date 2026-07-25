import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { pathForView } from './navigation/viewRoutes'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App navigation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('keeps a single Tasks workspace h1 while the topbar view label stays visible non-heading chrome', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(window.location.pathname).toBe('/tasks')

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Tasks')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('implements profile and progress log-session controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    const notices = await screen.findAllByText(/Profile settings live in this local/i)
    expect(notices.length).toBeGreaterThan(0)
    expect(window.location.pathname).toBe('/settings')

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(window.location.pathname).toBe('/progress')
    const logSessionButton = screen.getByRole('button', { name: 'Log session' })
    await user.click(logSessionButton)
    expect(await screen.findByRole('heading', { name: 'Log study session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Log study session' })).not.toBeInTheDocument()
    expect(logSessionButton).toHaveFocus()
  })

  it('navigates to Calendar from Upcoming widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const viewAllBtn = within(rightColumn).getByRole('button', { name: 'View all' })
    await user.click(viewAllBtn)

    // Confirm Calendar view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New event' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/calendar')
  })

  it('navigates to Flashcards from Review Queue widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const reviewCardsBtn = within(rightColumn).getByRole('button', { name: 'Review cards' })
    await user.click(reviewCardsBtn)

    // Confirm Flashcards view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New card' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/flashcards')
  })

  it('opens Home at / without auto-opening an editor', async () => {
    window.history.replaceState(null, '', '/')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it.each([
    ['/tasks', 'Tasks', 'New task'],
    ['/notes', 'Notes', 'New note'],
    ['/subjects', 'Subjects', 'New subject'],
    ['/calendar', 'Calendar', 'New event'],
    ['/flashcards', 'Flashcards', 'New card'],
    ['/progress', 'Progress', 'Log session'],
    ['/goals', 'Goals', 'New goal'],
    ['/settings', 'Settings', /Export data/],
  ] as const)('opens %s directly as %s without auto-opening an editor', async (path, heading, actionLabel) => {
    window.history.replaceState(null, '', path)
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
    expect(screen.getByRole('button', { name: actionLabel })).toBeInTheDocument()
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Note title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Subject name')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log study session' })).not.toBeInTheDocument()
  })

  it('pushes history on sidebar navigation and restores views on popstate', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tasks')
      expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    })

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/notes')
      expect(screen.getByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
    })
  })

  it('replaceStates unknown paths to Home without leaving an extra history entry', async () => {
    window.history.replaceState(null, '', '/')
    window.history.pushState(null, '', '/tasks')
    window.history.pushState(null, '', '/not-a-workspace')

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tasks')
      expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    })
  })
})
