import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LIVE_READ_ERROR_MESSAGE } from './components/AppLiveReadFallback'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { ROOT_ERROR_MESSAGE } from './components/RootErrorFallback'
import { GOALS_LIVE_READ_ERROR_MESSAGE } from './views/GoalsView'
import * as goalRead from './db/goalRead'
import * as subjectRead from './db/subjectRead'
import {
  ACTIVE_FOCUS_SESSION_KEY,
  createActiveFocusSession,
  getActiveFocusSession,
} from './db/activeFocusSession'
import { studyDb } from './db/studyDb'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'
import { makeDurableFocusSession } from './test/focusTestHelpers'
import { THEME_STORAGE_KEY } from './hooks/useThemePreference'

const SECRET_ERROR =
  'SECRET_STACK at /src/internal/evil.ts Dexie TransactionInactiveError id=abc-123'

function silenceBoundaryConsole() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined)
}

function ThrowingChild({ message = SECRET_ERROR }: { message?: string }): never {
  throw new Error(message)
}

function SometimesThrow({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error(SECRET_ERROR)
  return <p>Recovered child</p>
}

describe('Root render-error boundary', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('shows the root alert and Reload control when a child throws during render', async () => {
    const consoleSpy = silenceBoundaryConsole()
    const onReload = vi.fn()

    render(
      <RootErrorBoundary onReload={onReload}>
        <ThrowingChild />
      </RootErrorBoundary>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ROOT_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
    expect(screen.queryByText(/SECRET_STACK|evil\.ts|Dexie|abc-123/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(SECRET_ERROR)
    expect(onReload).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('replaces ordinary App UI with the root fallback for unexpected App render failures', async () => {
    const consoleSpy = silenceBoundaryConsole()

    function AppWithBomb() {
      const [boom] = useState(true)
      if (boom) throw new Error(SECRET_ERROR)
      return <App />
    }

    render(
      <RootErrorBoundary onReload={() => undefined}>
        <AppWithBomb />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(GOALS_LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('invokes the configured reload path exactly once per user activation and never auto-reloads', async () => {
    const consoleSpy = silenceBoundaryConsole()
    const user = userEvent.setup()
    const onReload = vi.fn()

    render(
      <RootErrorBoundary onReload={onReload}>
        <ThrowingChild />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)
    expect(onReload).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)

    consoleSpy.mockRestore()
  })

  it('keeps IndexedDB, localStorage, and focus intact across a root render failure', async () => {
    const consoleSpy = silenceBoundaryConsole()
    localStorage.setItem(THEME_STORAGE_KEY, 'ocean')
    await studyDb.subjects.add({
      id: 'subject-root-keep',
      name: 'Keep subject',
      color: '#2563eb',
      targetHours: 2,
      progress: 10,
      progressMode: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    const session = makeDurableFocusSession({
      id: 'focus-survive-root-error',
      subjectId: '',
      plannedMinutes: 25,
      status: 'running',
    })
    expect(await createActiveFocusSession(session)).toMatchObject({ ok: true })

    render(
      <RootErrorBoundary onReload={() => undefined}>
        <ThrowingChild />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('ocean')
    expect(await studyDb.subjects.get('subject-root-keep')).toMatchObject({ name: 'Keep subject' })
    expect(await getActiveFocusSession()).toMatchObject({ id: 'focus-survive-root-error', status: 'running' })
    expect((await studyDb.settings.get(ACTIVE_FOCUS_SESSION_KEY))?.value).toMatchObject({
      id: 'focus-survive-root-error',
    })

    consoleSpy.mockRestore()
  })

  it('stays on the stable fallback when the child would keep throwing', async () => {
    const consoleSpy = silenceBoundaryConsole()
    const onReload = vi.fn()

    const { rerender } = render(
      <RootErrorBoundary onReload={onReload}>
        <SometimesThrow shouldThrow />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)

    rerender(
      <RootErrorBoundary onReload={onReload}>
        <SometimesThrow shouldThrow />
      </RootErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(ROOT_ERROR_MESSAGE)
    expect(screen.queryByText('Recovered child')).not.toBeInTheDocument()
    expect(onReload).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('keeps App live-read failures on the App fallback when wrapped by the root boundary', async () => {
    const consoleSpy = silenceBoundaryConsole()
    vi.spyOn(subjectRead, 'listSubjects').mockRejectedValue(new Error('subjects boom'))

    render(
      <RootErrorBoundary onReload={() => undefined}>
        <App />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByText(ROOT_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('keeps Goals live-read failures on the Goals fallback when wrapped by the root boundary', async () => {
    const consoleSpy = silenceBoundaryConsole()
    const user = userEvent.setup()
    vi.spyOn(goalRead, 'listGoals').mockRejectedValue(new Error('goals boom'))

    render(
      <RootErrorBoundary onReload={() => undefined}>
        <App />
      </RootErrorBoundary>,
    )

    await user.click(await screen.findByRole('button', { name: 'Goals' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_LIVE_READ_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByText(ROOT_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByText(LIVE_READ_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('renders the normal App when no render error occurs under the root boundary', async () => {
    render(
      <RootErrorBoundary onReload={() => undefined}>
        <App />
      </RootErrorBoundary>,
    )

    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByText(ROOT_ERROR_MESSAGE)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })
})
