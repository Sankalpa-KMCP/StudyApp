import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ZenOverlay } from './ZenOverlay'
import type { ActiveFocusSession, StudySubject } from '../db/types'

describe('ZenOverlay', () => {
  const subjectMap = new Map<string, StudySubject>([
    [
      'sub-1',
      {
        id: 'sub-1',
        name: 'Mathematics',
        color: '#2563eb',
        targetHours: 10,
        progress: 20,
        progressMode: 'manual',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      },
    ],
  ])

  const activeSession: ActiveFocusSession = {
    id: 'focus-zen-1',
    subjectId: 'sub-1',
    startedAt: '2026-08-29T10:00:00.000Z',
    plannedMinutes: 25,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: 0,
  }

  it('renders active running session with timer, progress bar, pause and stop buttons', async () => {
    const user = userEvent.setup()
    const onPause = vi.fn()
    const onResume = vi.fn()
    const onStop = vi.fn()
    const onExit = vi.fn()
    const onDone = vi.fn()

    render(
      <ZenOverlay
        phase="active"
        activeSession={activeSession}
        subjectMap={subjectMap}
        elapsedSeconds={300}
        remainingSeconds={1200}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onExit={onExit}
        onDone={onDone}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Mathematics' })).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(onPause).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Exit Zen' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('opens confirm dialog when Stop session is clicked and confirms stop', async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()

    render(
      <ZenOverlay
        phase="active"
        activeSession={activeSession}
        subjectMap={subjectMap}
        elapsedSeconds={300}
        remainingSeconds={1200}
        onPause={() => undefined}
        onResume={() => undefined}
        onStop={onStop}
        onExit={() => undefined}
        onDone={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Stop session' }))
    expect(screen.getByRole('heading', { name: 'End this focus session?' })).toBeInTheDocument()

    // Confirm stop
    await user.click(screen.getByRole('button', { name: 'End session' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('renders completed presentation when phase is completed', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()

    render(
      <ZenOverlay
        phase="completed"
        activeSession={null}
        completionOutcome={{
          outcome: 'completed',
          minutes: 25,
          subjectName: 'Mathematics',
        }}
        subjectMap={subjectMap}
        elapsedSeconds={0}
        remainingSeconds={0}
        onPause={() => undefined}
        onResume={() => undefined}
        onStop={() => undefined}
        onExit={() => undefined}
        onDone={onDone}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Focus complete' })).toBeInTheDocument()
    expect(screen.getByText(/25m/)).toBeInTheDocument()
    expect(screen.getByText(/Mathematics/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
