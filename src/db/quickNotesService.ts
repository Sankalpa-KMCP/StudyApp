import { studyDb } from './studyDb'

const QUICK_NOTES_KEY = 'quickNotes'

/**
 * Persist Home Quick Notes to the settings table.
 * Owns the `quickNotes` key, newline normalization, and the eight-line cap.
 * Callers retain debounce, queue, draft, and retry UI.
 */
export async function saveQuickNotes(value: string): Promise<void> {
  await studyDb.settings.put({
    key: QUICK_NOTES_KEY,
    value: value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8),
  })
}
