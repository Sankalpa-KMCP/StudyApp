import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { pathForView } from './navigation/viewRoutes'
import { MOBILE_NAV_MAX_WIDTH_QUERY } from './navigation/navDestinations'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import * as subjectRead from './db/subjectRead'
import { studyDb } from './db/studyDb'

function mockMobileNav(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === MOBILE_NAV_MAX_WIDTH_QUERY ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('App mobile navigation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('keeps the desktop Sidebar and hides mobile navigation above the breakpoint', async () => {
    mockMobileNav(false)
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getByRole('complementary', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
  })

  it('renders mobile navigation without a duplicate desktop landmark', async () => {
    mockMobileNav(true)
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument()
  })

  it('navigates primary and More destinations with URL and Back/Forward support', async () => {
    mockMobileNav(true)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(window.location.pathname).toBe(pathForView('Tasks'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Subjects' }))
    expect(window.location.pathname).toBe(pathForView('Subjects'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Calendar' }))
    expect(window.location.pathname).toBe(pathForView('Calendar'))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Flashcards' }))
    expect(window.location.pathname).toBe(pathForView('Flashcards'))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Goals' }))
    expect(window.location.pathname).toBe(pathForView('Goals'))

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    expect(window.location.pathname).toBe(pathForView('Settings'))

    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe(pathForView('Goals')))
    window.history.forward()
    await waitFor(() => expect(window.location.pathname).toBe(pathForView('Settings')))
  })

  it('clears editor intents on mobile navigation like desktop', async () => {
    mockMobileNav(true)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    await user.click(screen.getByRole('button', { name: 'Tasks' }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    expect(screen.getByLabelText('Task title')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(window.location.pathname).toBe(pathForView('Notes'))
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument()
  })

  it('keeps Settings reachable during live-read recovery on mobile', async () => {
    mockMobileNav(true)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(subjectRead, 'listSubjects').mockRejectedValue(new Error('subjects unavailable'))
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    expect(window.location.pathname).toBe(pathForView('Settings'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show onboarding checklist' })).toBeInTheDocument()
  })

  it('preserves desktop sidebar collapse preference when not on mobile', async () => {
    mockMobileNav(false)
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(localStorage.getItem('study-dashboard-sidebar')).toBe('collapsed')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('coexists with Quick add and global search on mobile', async () => {
    mockMobileNav(true)
    const user = userEvent.setup()
    await studyDb.tasks.add({
      id: 'task-nav',
      title: 'Mobile search task',
      subjectId: '',
      dueDate: '',
      priority: 'normal',
      status: 'open',
      minutes: 20,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    })
    render(<App />)
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(screen.getByRole('menu', { name: 'Quick add' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'More' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    const search = screen.getByRole('combobox', { name: 'Search' })
    await user.type(search, 'Mobile search')
    expect(await screen.findByRole('option', { name: /Task.*Mobile search task/i })).toBeInTheDocument()
  })
})
