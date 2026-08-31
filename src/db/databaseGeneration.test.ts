import { beforeEach, describe, expect, it } from 'vitest'
import { studyDb } from './studyDb'
import {
  advanceDatabaseGeneration,
  assertCurrentDatabaseGeneration,
  assertExpectedDatabaseGeneration,
  CorruptDatabaseGenerationError,
  DATABASE_GENERATION_KEY,
  DatabaseGenerationOverflowError,
  getDatabaseGeneration,
  INITIAL_DATABASE_GENERATION,
  isDatabaseGeneration,
  parseDatabaseGeneration,
  StaleDatabaseGenerationError,
} from './databaseGeneration'

describe('databaseGeneration', () => {
  beforeEach(async () => {
    await studyDb.settings.clear()
  })

  describe('isDatabaseGeneration', () => {
    it('returns true for positive safe integers >= 1', () => {
      expect(isDatabaseGeneration(1)).toBe(true)
      expect(isDatabaseGeneration(2)).toBe(true)
      expect(isDatabaseGeneration(100)).toBe(true)
      expect(isDatabaseGeneration(Number.MAX_SAFE_INTEGER)).toBe(true)
    })

    it('returns false for invalid types, non-integers, and non-positive numbers', () => {
      expect(isDatabaseGeneration(0)).toBe(false)
      expect(isDatabaseGeneration(-1)).toBe(false)
      expect(isDatabaseGeneration(1.5)).toBe(false)
      expect(isDatabaseGeneration(NaN)).toBe(false)
      expect(isDatabaseGeneration(Infinity)).toBe(false)
      expect(isDatabaseGeneration(-Infinity)).toBe(false)
      expect(isDatabaseGeneration('1')).toBe(false)
      expect(isDatabaseGeneration(null)).toBe(false)
      expect(isDatabaseGeneration({})).toBe(false)
      expect(isDatabaseGeneration([])).toBe(false)
      expect(isDatabaseGeneration(true)).toBe(false)
      expect(isDatabaseGeneration(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
    })
  })

  describe('parseDatabaseGeneration', () => {
    it('returns INITIAL_DATABASE_GENERATION (1) when value is undefined (missing record)', () => {
      expect(parseDatabaseGeneration(undefined)).toBe(INITIAL_DATABASE_GENERATION)
    })

    it('returns valid generation values', () => {
      expect(parseDatabaseGeneration(1)).toBe(1)
      expect(parseDatabaseGeneration(5)).toBe(5)
      expect(parseDatabaseGeneration(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('throws CorruptDatabaseGenerationError for present-but-invalid values', () => {
      expect(() => parseDatabaseGeneration('1')).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(null)).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration({})).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(0)).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(-10)).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(3.14159)).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(NaN)).toThrow(CorruptDatabaseGenerationError)
      expect(() => parseDatabaseGeneration(Infinity)).toThrow(CorruptDatabaseGenerationError)
    })
  })

  describe('assertExpectedDatabaseGeneration', () => {
    it('passes when expected matches current generation', () => {
      expect(() => assertExpectedDatabaseGeneration(4, 4)).not.toThrow()
    })

    it('throws StaleDatabaseGenerationError when expected does not match current generation', () => {
      expect(() => assertExpectedDatabaseGeneration(4, 5)).toThrow(StaleDatabaseGenerationError)
      try {
        assertExpectedDatabaseGeneration(4, 5)
      } catch (err) {
        expect(err).toBeInstanceOf(StaleDatabaseGenerationError)
        const staleErr = err as StaleDatabaseGenerationError
        expect(staleErr.expectedGeneration).toBe(4)
        expect(staleErr.currentGeneration).toBe(5)
      }
    })
  })

  describe('table-level helpers (Dexie settings)', () => {
    it('getDatabaseGeneration returns 1 when key is missing', async () => {
      const gen = await getDatabaseGeneration(studyDb.settings)
      expect(gen).toBe(1)
    })

    it('getDatabaseGeneration returns persisted valid generation', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 7 })
      const gen = await getDatabaseGeneration(studyDb.settings)
      expect(gen).toBe(7)
    })

    it('getDatabaseGeneration throws CorruptDatabaseGenerationError on corrupt value', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 'corrupt' })
      await expect(getDatabaseGeneration(studyDb.settings)).rejects.toThrow(CorruptDatabaseGenerationError)
    })

    it('assertCurrentDatabaseGeneration passes when matching and throws on mismatch', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })
      await expect(assertCurrentDatabaseGeneration(studyDb.settings, 3)).resolves.toBe(3)
      await expect(assertCurrentDatabaseGeneration(studyDb.settings, 2)).rejects.toThrow(StaleDatabaseGenerationError)
    })

    it('advanceDatabaseGeneration increments generation from missing (1 -> 2)', async () => {
      const next = await advanceDatabaseGeneration(studyDb.settings)
      expect(next).toBe(2)

      const stored = await studyDb.settings.get(DATABASE_GENERATION_KEY)
      expect(stored?.value).toBe(2)
    })

    it('advanceDatabaseGeneration increments generation from existing value (10 -> 11)', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 10 })
      const next = await advanceDatabaseGeneration(studyDb.settings)
      expect(next).toBe(11)

      const stored = await studyDb.settings.get(DATABASE_GENERATION_KEY)
      expect(stored?.value).toBe(11)
    })

    it('advanceDatabaseGeneration throws DatabaseGenerationOverflowError at MAX_SAFE_INTEGER and never wraps', async () => {
      await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: Number.MAX_SAFE_INTEGER })
      await expect(advanceDatabaseGeneration(studyDb.settings)).rejects.toThrow(DatabaseGenerationOverflowError)

      // Verify value in DB was NOT modified or wrapped to 0 or 1
      const stored = await studyDb.settings.get(DATABASE_GENERATION_KEY)
      expect(stored?.value).toBe(Number.MAX_SAFE_INTEGER)
    })
  })
})
