import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveQuickNotes } from './quickNotesService'
import { studyDb } from './studyDb'

describe('quickNotesService', () => {
  beforeEach(async () => {
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
    await saveQuickNotes('same\nsame\nother')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual(['same', 'same', 'other'])
  })

  it('persists an empty array for empty or whitespace-only input', async () => {
    await saveQuickNotes('')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual([])

    await saveQuickNotes('  \n\t\n  ')
    expect((await studyDb.settings.get('quickNotes'))?.value).toEqual([])
  })

  it('writes the quickNotes settings key with normalized lines', async () => {
    await saveQuickNotes('One\n\n  Two  \nThree')

    expect(await studyDb.settings.get('quickNotes')).toEqual({
      key: 'quickNotes',
      value: ['One', 'Two', 'Three'],
    })
  })

  it('propagates persistence failures', async () => {
    vi.spyOn(studyDb.settings, 'put').mockRejectedValueOnce(new Error('settings write failed'))

    await expect(saveQuickNotes('Keep me')).rejects.toThrow('settings write failed')
    expect(await studyDb.settings.get('quickNotes')).toBeUndefined()
  })
})
