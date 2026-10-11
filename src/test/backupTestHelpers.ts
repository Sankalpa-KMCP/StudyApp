import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import { parseAndNormalizeStudyExport } from '../db/studyDb'

export function makeEmptyExport(overrides: Record<string, unknown> = {}) {
  return {
    version: 4 as const,
    exportedAt: '2026-06-29T00:00:00.000Z',
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    studySessions: [],
    goals: [],
    settings: [],
    ...overrides,
  }
}

export async function importStudyExport(
  user: ReturnType<typeof userEvent.setup>,
  payload: unknown,
  filename = 'backup.json',
) {
  await user.click(await screen.findByRole('button', { name: 'Settings' }))
  const importInput = screen.getByLabelText(/Import data/)
  await user.upload(importInput, new File([JSON.stringify(payload)], filename, { type: 'application/json' }))
  // Invalid selections have no confirmation action; callers assert the error.
  try { parseAndNormalizeStudyExport(payload) } catch { return }
  await user.click(await screen.findByRole('button', { name: 'Replace my study data' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Study data imported.'))
}
