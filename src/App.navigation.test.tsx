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

  it('redirects legacy /flashcards route to Home', async () => {
    window.history.replaceState(null, '', '/flashcards')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
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

  it('opens the task editor once from Home and does not replay it after Back/Forward or ordinary return', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = await screen.findByLabelText('Today overview')
    await user.click(within(hero).getByRole('button', { name: 'Task' }))
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/tasks')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tasks')
      expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/notes')
    })

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(within(screen.getByLabelText('Today overview')).getByRole('button', { name: 'Task' }))
    expect(await screen.findByLabelText('Task title')).toBeInTheDocument()
  })

  it('opens the subject editor once from Home and does not replay it after Back/Forward or ordinary return', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = await screen.findByLabelText('Today overview')
    await user.click(within(hero).getByRole('button', { name: 'Subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/subjects')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Subject name')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()

    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/subjects')
      expect(screen.getByRole('heading', { level: 1, name: 'Subjects' })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Subject name')).not.toBeInTheDocument()

    act(() => {
      window.history.forward()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/notes')
    })

    await user.click(screen.getByRole('button', { name: 'Subjects' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Subjects' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Subject name')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(within(screen.getByLabelText('Today overview')).getByRole('button', { name: 'Subject' }))
    expect(await screen.findByLabelText('Subject name')).toBeInTheDocument()
  })

  it('keeps Home focus attention one-shot across ordinary navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await user.click(within(screen.getByRole('region', { name: 'Your first study loop' })).getByRole('button', { name: 'Go to focus' }))
    expect(await screen.findByRole('button', { name: 'Start focus' })).toHaveFocus()
    expect(window.location.pathname).toBe('/')

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('button', { name: 'Start focus' })).not.toHaveFocus()
  })

  it('synchronizes document.title on initial load and client-side navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(document.title).toBe('Study Dashboard')

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(document.title).toBe('Tasks — Study Dashboard')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(document.title).toBe('Settings — Study Dashboard')
  })

  it('moves programmatic focus to workspace h1 on client navigation without stealing focus on initial load', async () => {
    const user = userEvent.setup()
    render(<App />)

    const homeHeading = await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    // On initial mount, focus is NOT stolen to heading
    expect(homeHeading).not.toHaveFocus()

    // Navigate to Tasks via keyboard/click
    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    const tasksHeading = await screen.findByRole('heading', { level: 1, name: 'Tasks' })
    expect(tasksHeading).toHaveFocus()
    expect(tasksHeading).toHaveAttribute('tabindex', '-1')

    // Navigate to Notes
    await user.click(screen.getByRole('button', { name: 'Notes' }))
    const notesHeading = await screen.findByRole('heading', { level: 1, name: 'Notes' })
    expect(notesHeading).toHaveFocus()

    // Browser Back (popstate)
    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toHaveFocus()
      expect(document.title).toBe('Tasks — Study Dashboard')
    })
  })

  it('does not cause focus churn on no-op navigation to already-active view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))
    const tasksHeading = await screen.findByRole('heading', { level: 1, name: 'Tasks' })
    expect(tasksHeading).toHaveFocus()

    // Click Tasks navigation button again (no-op navigation)
    const navItem = screen.getByRole('button', { name: 'Tasks' })
    await user.click(navItem)

    // Focus stays on clicked navigation item rather than being reset back to heading
    expect(tasksHeading).not.toHaveFocus()
    expect(navItem).toHaveFocus()
  })
})
