import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  createActiveFocusSession,
  finalizeActiveFocusSession,
} from './db/activeFocusSession'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession } from './test/focusTestHelpers'

const THEME_CASES = [
  ['monochrome', '#111111'],
  ['light', '#f4f0e8'],
  ['dark', '#10141d'],
  ['aurora', '#111323'],
  ['ember', '#f3e4d2'],
  ['blueprint', '#153f73'],
  ['moss', '#294633'],
] as const

describe('App', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
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


  it('focuses and clears global search with keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    const searchInput = await screen.findByPlaceholderText('Search')
    await user.keyboard('/')
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('')
    expect(searchInput).not.toHaveFocus()
  })


  it('toggles dark mode from settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it.each(THEME_CASES)('restores the saved %s theme preference', async (theme, themeColor) => {
    localStorage.setItem('study-dashboard-theme', theme)
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe(theme)
    expect(localStorage.getItem('study-dashboard-theme')).toBe(theme)
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', themeColor)
  })

  it('falls back to Monochrome when a saved theme preference is invalid', async () => {
    localStorage.setItem('study-dashboard-theme', 'unknown-theme')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('monochrome')
    expect(localStorage.getItem('study-dashboard-theme')).toBe('monochrome')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111111')
  })

  it('collapses and expands the desktop sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(document.querySelector('.app-shell')).toHaveClass('is-sidebar-collapsed')

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(document.querySelector('.app-shell')).not.toHaveClass('is-sidebar-collapsed')
  })

  it('supports all seven theme choices and updates new theme metadata', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const themeGroup = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(themeGroup).getAllByRole('radio')).toHaveLength(7)
    const monochromeOption = within(themeGroup).getByRole('radio', { name: /Monochrome/ })
    const canvasOption = within(themeGroup).getByRole('radio', { name: /Canvas/ })
    const emberOption = within(themeGroup).getByRole('radio', { name: /Ember/ })
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')
    expect(monochromeOption).toHaveAttribute('tabindex', '0')
    expect(canvasOption).toHaveAttribute('tabindex', '-1')

    monochromeOption.focus()
    await user.keyboard('{ArrowRight}')
    expect(canvasOption).toHaveFocus()
    expect(canvasOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(emberOption).toHaveFocus()
    expect(emberOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(monochromeOption).toHaveFocus()
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')

    for (const [label, theme, themeColor] of [
      ['Blueprint', 'blueprint', '#153f73'],
      ['Moss Library', 'moss', '#294633'],
      ['Monochrome', 'monochrome', '#111111'],
    ] as const) {
      const option = within(themeGroup).getByRole('radio', { name: new RegExp(label) })
      await user.click(option)
      expect(option).toHaveAttribute('aria-checked', 'true')
      expect(document.documentElement.dataset.theme).toBe(theme)
      expect(localStorage.getItem('study-dashboard-theme')).toBe(theme)
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', themeColor)
    }
  })


  it('persists existing theme choices to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: /Aurora/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('aurora')

    await user.click(screen.getByRole('radio', { name: /Ember/ }))
    expect(localStorage.getItem('study-dashboard-theme')).toBe('ember')
  })

  it('clears active search from the settings panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByPlaceholderText('Search'), 'biology')
    expect(screen.getByPlaceholderText('Search')).toHaveValue('biology')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(screen.getByPlaceholderText('Search')).toHaveValue('')
  })

  it('opens and closes the notice popover', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(noticesBtn).toHaveAttribute('aria-controls', 'notice-popover')
    expect(document.getElementById('notice-popover')).toBeNull()

    await user.click(noticesBtn)

    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')
    const popover = document.getElementById('notice-popover')
    expect(popover).not.toBeNull()
    expect(popover).toHaveAttribute('role', 'status')
    expect(within(popover as HTMLElement).getByText(/completed tasks/)).toBeInTheDocument()

    await user.click(noticesBtn)
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('notice-popover')).toBeNull()
  })

  it('closes the notice popover with Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')

    const searchInput = screen.getByPlaceholderText('Search')
    await user.click(searchInput)
    expect(searchInput).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(document.getElementById('notice-popover')).toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'false')
    expect(noticesBtn).toHaveFocus()
  })

  it('Escape closes an open notice popover without clearing search text', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    const searchInput = screen.getByPlaceholderText('Search')

    await user.click(searchInput)
    await user.type(searchInput, 'keep-me')
    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()

    await user.click(searchInput)
    expect(searchInput).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(document.getElementById('notice-popover')).toBeNull()
    expect(searchInput).toHaveValue('keep-me')
    expect(noticesBtn).toHaveFocus()
  })

  it('reopens the notice popover after Escape and keeps search Escape when closed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
    const noticesBtn = screen.getByRole('button', { name: 'Notifications' })
    const searchInput = screen.getByPlaceholderText('Search')

    await user.click(noticesBtn)
    await user.keyboard('{Escape}')
    expect(document.getElementById('notice-popover')).toBeNull()
    expect(noticesBtn).toHaveFocus()

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).not.toBeNull()
    expect(noticesBtn).toHaveAttribute('aria-expanded', 'true')

    await user.click(noticesBtn)
    expect(document.getElementById('notice-popover')).toBeNull()

    await user.click(searchInput)
    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('')
    expect(searchInput).not.toHaveFocus()
    expect(document.getElementById('notice-popover')).toBeNull()
  })


  it('shows friendly feedback when theme preference persistence fails', async () => {
    const user = userEvent.setup()
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'study-dashboard-theme') throw new Error('quota exceeded')
      return originalSetItem.call(this, key, value)
    })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('radio', { name: /Midnight/ }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(await screen.findByRole('alert')).toHaveTextContent('Theme preference could not be saved.')
    expect(screen.queryByText(/quota exceeded/i)).not.toBeInTheDocument()
  })


  it('does not create duplicate history rows for repeated finalization', async () => {
    const session = makeDurableFocusSession({
      id: 'focus-idempotent',
      subjectId: '',
      plannedMinutes: 0,
      startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    })
    await createActiveFocusSession(session)

    const first = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 3,
      note: 'Focus session',
    })
    const second = await finalizeActiveFocusSession(session.id, {
      subjectId: '',
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      minutes: 99,
      note: 'Duplicate',
    })

    expect(first.ok).toBe(true)
    expect(second).toEqual(first)
    expect(await studyDb.studySessions.count()).toBe(1)
    expect(await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY)).toBeUndefined()
  })


})
