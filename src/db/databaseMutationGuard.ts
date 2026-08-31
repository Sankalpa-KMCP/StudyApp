import { withSharedDatabaseLock } from './crossTabLock'
import {
  assertCurrentDatabaseGeneration,
  getDatabaseGeneration,
} from './databaseGeneration'
import { studyDb } from './studyDb'

/**
 * Explicit mutation context required for all stale-capable persistent writes.
 * The `expectedGeneration` must match the current database generation at the
 * moment the mutation executes under the shared database Web Lock.
 */
export type DatabaseMutationContext = {
  readonly expectedGeneration: number
}

/**
 * Validates that `context` is a structurally valid `DatabaseMutationContext`.
 * Throws a runtime Error if omitted, null, or has an invalid generation number.
 */
export function assertDatabaseMutationContext(
  context: unknown,
): asserts context is DatabaseMutationContext {
  if (
    context === null
    || typeof context !== 'object'
    || typeof (context as DatabaseMutationContext).expectedGeneration !== 'number'
    || !Number.isInteger((context as DatabaseMutationContext).expectedGeneration)
    || (context as DatabaseMutationContext).expectedGeneration < 1
  ) {
    throw new Error('Valid DatabaseMutationContext with expectedGeneration >= 1 is required for guarded mutations.')
  }
}

/**
 * Safely captures the authoritative current logical database generation under a shared Web Lock.
 * Used when initializing a long-lived editor, draft, or focus workflow epoch.
 */
export async function captureDatabaseGeneration(): Promise<number> {
  return withSharedDatabaseLock(async () => {
    return getDatabaseGeneration(studyDb.settings)
  })
}

/**
 * Executes a stale-capable database mutation under the shared database Web Lock.
 *
 * Sequence:
 * 1. Validates mutation context shape.
 * 2. Acquires shared database Web Lock.
 * 3. Asserts current database generation matches `context.expectedGeneration` (throws `StaleDatabaseGenerationError` if mismatch).
 * 4. Executes the caller's mutation / Dexie transaction while continuously holding the shared lock.
 * 5. Releases the shared lock upon completion or error.
 */
export async function withGuardedMutation<T>(
  context: DatabaseMutationContext,
  mutate: () => Promise<T>,
): Promise<T> {
  assertDatabaseMutationContext(context)

  return withSharedDatabaseLock(async () => {
    await assertCurrentDatabaseGeneration(studyDb.settings, context.expectedGeneration)
    return mutate()
  })
}

/**
 * Executes an immediate, non-stale background/preference write under the shared database Web Lock.
 * Reads the current generation under the lock and passes it to the mutation callback.
 * Ensures the write cannot interleave with an exclusive destructive import/clear operation.
 */
export async function withCurrentGenerationMutation<T>(
  mutate: (generation: number) => Promise<T>,
): Promise<T> {
  return withSharedDatabaseLock(async () => {
    const currentGeneration = await getDatabaseGeneration(studyDb.settings)
    return mutate(currentGeneration)
  })
}
