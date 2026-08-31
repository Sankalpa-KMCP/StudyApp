import { beforeEach, describe, expect, it } from 'vitest'
import {
  DATABASE_GENERATION_KEY,
  StaleDatabaseGenerationError,
} from './databaseGeneration'
import {
  assertDatabaseMutationContext,
  captureDatabaseGeneration,
  withCurrentGenerationMutation,
  withGuardedMutation,
} from './databaseMutationGuard'
import {
  installInMemoryLockAdapter,
  withExclusiveDatabaseLock,
} from './crossTabLock'
import { studyDb } from './studyDb'

describe('databaseMutationGuard', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.settings.clear()
  })

  describe('assertDatabaseMutationContext', () => {
    it('accepts valid context shapes', () => {
      expect(() => assertDatabaseMutationContext({ expectedGeneration: 1 })).not.toThrow()
      expect(() => assertDatabaseMutationContext({ expectedGeneration: 42 })).not.toThrow()
    })

    it('rejects invalid context shapes', () => {
      expect(() => assertDatabaseMutationContext(undefined)).toThrow()
      expect(() => assertDatabaseMutationContext(null)).toThrow()
      expect(() => assertDatabaseMutationContext({})).toThrow()
      expect(() => assertDatabaseMutationContext({ expectedGeneration: 0 })).toThrow()
      expect(() => assertDatabaseMutationContext({ expectedGeneration: -1 })).toThrow()
      expect(() => assertDatabaseMutationContext({ expectedGeneration: 1.5 })).toThrow()
      expect(() => assertDatabaseMutationContext({ expectedGeneration: '1' })).toThrow()
    })
  })

  describe('captureDatabaseGeneration', () => {
    it('returns baseline 1 when no generation record exists', async () => {
      const gen = await captureDatabaseGeneration()
      expect(gen).toBe(1)
    })

    it('returns stored generation under shared lock', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 5 })
      const gen = await captureDatabaseGeneration()
      expect(gen).toBe(5)
    })
  })

  describe('withGuardedMutation', () => {
    it('executes mutation when expected generation matches stored generation', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })
      let executed = false

      const result = await withGuardedMutation({ expectedGeneration: 3 }, async () => {
        executed = true
        return 'success'
      })

      expect(executed).toBe(true)
      expect(result).toBe('success')
    })

    it('rejects with StaleDatabaseGenerationError when expected generation mismatches', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 4 })
      let executed = false

      await expect(
        withGuardedMutation({ expectedGeneration: 3 }, async () => {
          executed = true
        }),
      ).rejects.toThrow(StaleDatabaseGenerationError)

      expect(executed).toBe(false)
    })

    it('holds shared lock preventing concurrent exclusive writes during mutation', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 2 })
      const events: string[] = []

      let releaseShared: (() => void) | null = null
      const sharedPromise = withGuardedMutation({ expectedGeneration: 2 }, async () => {
        events.push('shared-start')
        await new Promise<void>((resolve) => {
          releaseShared = resolve
        })
        events.push('shared-end')
      })

      // Try acquiring exclusive lock while shared mutation is in flight
      const exclusivePromise = withExclusiveDatabaseLock(async () => {
        events.push('exclusive-executed')
      })

      // Give microtasks a tick
      await new Promise((r) => setTimeout(r, 10))
      expect(events).toEqual(['shared-start'])

      // Release shared lock
      releaseShared!()
      await Promise.all([sharedPromise, exclusivePromise])

      expect(events).toEqual(['shared-start', 'shared-end', 'exclusive-executed'])
    })
  })

  describe('withCurrentGenerationMutation', () => {
    it('provides current generation to callback and executes under shared lock', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 7 })

      const observedGen = await withCurrentGenerationMutation(async (gen) => {
        return gen
      })

      expect(observedGen).toBe(7)
    })
  })
})
