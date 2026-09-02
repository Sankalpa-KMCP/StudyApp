import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as studyDbModule from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

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


  it('focuses and clears global search with keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    const searchInput = await screen.findByPlaceholderText('Search')
    await user.keyboard('/')
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, 'calculus')
    await user.keyboard('{Escape}')
    expect(searchInput).toHaveValue('calculus')
    expect(searchInput).toHaveFocus()
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

  it('supports all 11 theme choices and updates theme metadata', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    const themeGroup = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(themeGroup).getAllByRole('radio')).toHaveLength(11)
    const monochromeOption = within(themeGroup).getByRole('radio', { name: /Monochrome/ })
    const canvasOption = within(themeGroup).getByRole('radio', { name: /Canvas/ })
    const obsidianOption = within(themeGroup).getByRole('radio', { name: /High-Contrast Obsidian/ })
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')
    expect(monochromeOption).toHaveAttribute('tabindex', '0')
    expect(canvasOption).toHaveAttribute('tabindex', '-1')

    monochromeOption.focus()
    await user.keyboard('{ArrowRight}')
    expect(canvasOption).toHaveFocus()
    expect(canvasOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(obsidianOption).toHaveFocus()
    expect(obsidianOption).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(monochromeOption).toHaveFocus()
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')

    for (const [label, theme, themeColor] of [
      ['Blueprint', 'blueprint', '#153f73'],
      ['Moss Library', 'moss', '#294633'],
      ['Sage Botanical', 'sage', '#eaf0eb'],
      ['Nordic Slate', 'nordic', '#12161f'],
      ['Espresso', 'espresso', '#181412'],
      ['High-Contrast Obsidian', 'obsidian', '#0c0d11'],
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
    expect(searchInput).toHaveValue('calculus')
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

  describe('legacy migration startup integration', () => {
    it.each([
      ['already_migrated', { status: 'already_migrated' }],
      ['no_legacy_data', { status: 'no_legacy_data' }],
      ['demo_data_skipped', { status: 'demo_data_skipped' }],
      ['empty_data_skipped', { status: 'empty_data_skipped' }],
    ] as const)('handles %s migration status silently without notice alerts', async (_, result) => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue(result as studyDbModule.MigrationResult)
      render(<App />)

      expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/Legacy study data/i)).not.toBeInTheDocument()
    })

    it('shows a non-blocking success notice on successful legacy migration', async () => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({
        status: 'success',
        recordCount: 5,
      })
      render(<App />)

      expect(await screen.findByRole('status')).toHaveTextContent('Legacy study data imported successfully.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows a recoverable notice when legacy data is invalid', async () => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({
        status: 'invalid_data',
        reason: 'SyntaxError: Unexpected token in JSON at position 12',
      })
      render(<App />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Legacy study data could not be imported due to invalid formatting')
      expect(alert).toHaveTextContent('Your legacy data remains preserved on this device and can be retried after reloading or correcting the data.')
      expect(screen.queryByText(/SyntaxError/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument()
    })

    it('shows a data-protection notice when legacy data collides with existing records', async () => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({
        status: 'collision',
        entity: 'tasks',
        id: 'task-123',
      })
      render(<App />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Legacy study data migration was stopped to protect existing records from conflicts.')
      expect(alert).toHaveTextContent('No data was changed.')
      expect(screen.queryByText(/task-123/i)).not.toBeInTheDocument()
    })

    it('shows a retry-safe storage failure notice when migration transaction fails', async () => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({
        status: 'transaction_failed',
        error: 'QuotaExceededError: Storage limit reached',
      })
      render(<App />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Legacy study data could not be imported due to a storage error.')
      expect(alert).toHaveTextContent('No data was changed, and migration can be retried by reloading the page.')
      expect(screen.queryByText(/QuotaExceededError/i)).not.toBeInTheDocument()
    })

    it('shows a warning notice when legacy storage cleanup fails after migration', async () => {
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({
        status: 'cleanup_failed',
      })
      render(<App />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Legacy study data was imported successfully, but obsolete browser storage could not be removed.')
      expect(alert).toHaveTextContent('Future imports are safely prevented.')
    })

    it('invokes migration only once under React StrictMode', async () => {
      const spy = vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockResolvedValue({ status: 'no_legacy_data' })
      render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )

      await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('does not update state if the component unmounts before migration resolves', async () => {
      let resolveMigration!: (res: studyDbModule.MigrationResult) => void
      const migrationPromise = new Promise<studyDbModule.MigrationResult>((resolve) => {
        resolveMigration = resolve
      })
      vi.spyOn(studyDbModule, 'migrateLegacyLocalStorage').mockReturnValue(migrationPromise)

      const { unmount } = render(<App />)
      unmount()

      resolveMigration({ status: 'invalid_data', reason: 'bad json' })
      await flushDeferredAppWork()

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
