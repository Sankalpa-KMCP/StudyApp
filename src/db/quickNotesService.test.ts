import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveQuickNotes } from './quickNotesService'
import { DATABASE_GENERATION_KEY, StaleDatabaseGenerationError } from './databaseGeneration'
import { installInMemoryLockAdapter } from './crossTabLock'
import { studyDb } from './studyDb'

describe('quickNotesService', () => {
  beforeEach(async () => {
    installInMemoryLockAdapter()
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('normalizes multi-line text with trimming, blank removal, and an eight-line cap', async () => {
    await saveQuickNotes(
      '  alpha  \n\nbeta\n  \ngamma\ndelta\nepsilon\nzeta\neta\ntheta\niota\nkappa\n',
      { expectedGeneration: 1 },
    )

    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
    ])
  })

  it('preserves line order and duplicate non-empty lines', async () => {
    await saveQuickNotes('same\nsame\nother', { expectedGeneration: 1 })
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['same', 'same', 'other'])
  })

  it('persists an empty array for empty or whitespace-only input', async () => {
    await saveQuickNotes('', { expectedGeneration: 1 })
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual([])

    await saveQuickNotes('  \n\t\n  ', { expectedGeneration: 1 })
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual([])
  })

  it('writes the quickNotes settings key with normalized lines', async () => {
    await saveQuickNotes('One\n\n  Two  \nThree', { expectedGeneration: 1 })

    expect(await studyDb.settings.get('quickNotes')).toEqual({
      key: 'quickNotes',
      value: ['One', 'Two', 'Three'],
    })
  })

  it('rejects saveQuickNotes when generation is stale', async () => {
    await studyDb.settings.put({ key: DATABASE_GENERATION_KEY, value: 3 })

    await expect(saveQuickNotes('Stale note content', { expectedGeneration: 2 })).rejects.toThrow(StaleDatabaseGenerationError)
    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
  })

  it('propagates persistence failures', async () => {
    vi.spyOn(studyDb.settings, 'put').mockRejectedValueOnce(new Error('settings write failed'))

    await expect(saveQuickNotes('Keep me', { expectedGeneration: 1 })).rejects.toThrow('settings write failed')
    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
  })
})
