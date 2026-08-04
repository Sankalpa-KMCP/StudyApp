import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export function makeEmptyExport(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: '2026-06-29T00:00:00.000Z',
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    flashcards: [],
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
}
