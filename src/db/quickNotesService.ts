import { runBackupableMutation } from './backupabilityGuard'
import {
  type DatabaseMutationContext,
  withGuardedMutation,
} from './databaseMutationGuard'
import { studyDb } from './studyDb'

const QUICK_NOTES_KEY = 'quickNotes'
export const QUICK_NOTES_LIMIT_MESSAGE = 'Quick notes support up to 8 nonblank lines. Remove extra lines before saving. Your full draft is still available.'

/** Normalize without silently dropping user content. Shared by the editor and persistence boundary. */
export function normalizeQuickNotesDraft(value: string): string[] {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 8) throw new Error(QUICK_NOTES_LIMIT_MESSAGE)
  return lines
}

/**
 * Persist Home Quick Notes to the settings table under database generation guard and canonical backupability guard.
 * Owns the `quickNotes` key, newline normalization, and the eight-line cap.
 * Callers retain debounce, queue, draft, and retry UI.
 */
export async function saveQuickNotes(
  value: string,
  context: DatabaseMutationContext,
): Promise<void> {
  const lines = normalizeQuickNotesDraft(value)
  return withGuardedMutation(context, async () => {
    return runBackupableMutation(async () => {
      await studyDb.settings.put({
        key: QUICK_NOTES_KEY,
        value: lines,
      })
    })
  })
}
