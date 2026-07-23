import { screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { ActiveFocusSession } from '../db/types'

export async function waitForFocusStartEnabled() {
  const startButton = await screen.findByRole('button', { name: 'Start focus' })
  await waitFor(() => expect(startButton).toBeEnabled())
  return startButton
}

export function makeDurableFocusSession(overrides: Partial<ActiveFocusSession> = {}): ActiveFocusSession {
  return {
    id: 'focus-restored',
    subjectId: 'subject-focus',
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    plannedMinutes: 25,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: 0,
    ...overrides,
  }
}
