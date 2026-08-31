import type { Table } from 'dexie'
import type { StudySetting } from './types'

export const DATABASE_GENERATION_KEY = 'databaseGeneration'
export const INITIAL_DATABASE_GENERATION = 1

export class CorruptDatabaseGenerationError extends Error {
  readonly code = 'CORRUPT_DATABASE_GENERATION'
  readonly invalidValue: unknown

  constructor(invalidValue: unknown, message = 'Database generation metadata is present but corrupt.') {
    super(message)
    this.name = 'CorruptDatabaseGenerationError'
    this.invalidValue = invalidValue
  }
}

export class StaleDatabaseGenerationError extends Error {
  readonly code = 'STALE_DATABASE_GENERATION'
  readonly expectedGeneration: number
  readonly currentGeneration: number

  constructor(
    expectedGeneration: number,
    currentGeneration: number,
    message = `Stale database generation: expected ${expectedGeneration}, found ${currentGeneration}.`,
  ) {
    super(message)
    this.name = 'StaleDatabaseGenerationError'
    this.expectedGeneration = expectedGeneration
    this.currentGeneration = currentGeneration
  }
}

export class DatabaseGenerationOverflowError extends Error {
  readonly code = 'DATABASE_GENERATION_OVERFLOW'

  constructor(message = 'Database generation exceeded maximum safe integer limit.') {
    super(message)
    this.name = 'DatabaseGenerationOverflowError'
  }
}

/**
 * Type guard for valid database generation numbers.
 * Must be a safe positive integer >= 1.
 */
export function isDatabaseGeneration(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && Number.isSafeInteger(value)
    && value >= INITIAL_DATABASE_GENERATION
  )
}

/**
 * Pure parser for persisted generation values.
 * Returns `INITIAL_DATABASE_GENERATION` (1) if the key is genuinely absent (`value === undefined`).
 * Throws `CorruptDatabaseGenerationError` if present but invalid (string, object, null, NaN, negative, zero, fraction, float, or overflow).
 */
export function parseDatabaseGeneration(value: unknown): number {
  if (value === undefined) {
    return INITIAL_DATABASE_GENERATION
  }
  if (isDatabaseGeneration(value)) {
    return value
  }
  throw new CorruptDatabaseGenerationError(value)
}

/**
 * Pure assertion comparing expected vs current generation.
 * Throws `StaleDatabaseGenerationError` on mismatch.
 */
export function assertExpectedDatabaseGeneration(expectedGeneration: number, currentGeneration: number): void {
  if (expectedGeneration !== currentGeneration) {
    throw new StaleDatabaseGenerationError(expectedGeneration, currentGeneration)
  }
}

/**
 * Reads the current logical database generation from a supplied Settings table.
 * Returns 1 if missing; throws `CorruptDatabaseGenerationError` if corrupt.
 * Does not open a nested Dexie transaction.
 */
export async function getDatabaseGeneration(
  settingsTable: Table<StudySetting, string>,
): Promise<number> {
  const record = await settingsTable.get(DATABASE_GENERATION_KEY)
  return parseDatabaseGeneration(record?.value)
}

/**
 * Validates that the current database generation in the supplied Settings table matches `expectedGeneration`.
 * Throws `StaleDatabaseGenerationError` on mismatch or `CorruptDatabaseGenerationError` if corrupt.
 * Does not open a nested Dexie transaction.
 */
export async function assertCurrentDatabaseGeneration(
  settingsTable: Table<StudySetting, string>,
  expectedGeneration: number,
): Promise<number> {
  const current = await getDatabaseGeneration(settingsTable)
  assertExpectedDatabaseGeneration(expectedGeneration, current)
  return current
}

/**
 * Atomically computes and persists the next database generation in the supplied Settings table.
 * Operates inside the caller's existing Dexie transaction without opening a nested transaction.
 * Throws `DatabaseGenerationOverflowError` if current reaches Number.MAX_SAFE_INTEGER.
 * Never wraps or reuses prior generation values.
 */
export async function advanceDatabaseGeneration(
  settingsTable: Table<StudySetting, string>,
): Promise<number> {
  const record = await settingsTable.get(DATABASE_GENERATION_KEY)
  const current = parseDatabaseGeneration(record?.value)
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new DatabaseGenerationOverflowError()
  }
  const next = current + 1
  await settingsTable.put({ key: DATABASE_GENERATION_KEY, value: next })
  return next
}
