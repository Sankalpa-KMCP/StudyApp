import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { studyDb } from './studyDb'
import { EMPTY_UI_SETTINGS, getUiSettings } from './uiSettingsRead'

describe('uiSettingsRead', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('returns valid dailyGoalMinutes and quickNotes values', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 180 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['alpha', 'beta'] })
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: true })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 180,
      quickNotes: ['alpha', 'beta'],
      onboardingChecklistDismissed: true,
    })
  })

  it('falls back when both keys are absent', async () => {
    await expect(getUiSettings()).resolves.toEqual(EMPTY_UI_SETTINGS)
  })

  it('falls back malformed dailyGoalMinutes while keeping valid quickNotes', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: '240' })
    await studyDb.settings.put({ key: 'quickNotes', value: ['keep'] })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 240,
      quickNotes: ['keep'],
      onboardingChecklistDismissed: false,
    })
  })

  it('falls back non-finite dailyGoalMinutes to 240', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: Number.NaN })
    await expect(getUiSettings()).resolves.toMatchObject({ dailyGoalMinutes: 240 })

    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: Number.POSITIVE_INFINITY })
    await expect(getUiSettings()).resolves.toMatchObject({ dailyGoalMinutes: 240 })
  })

  it('falls back malformed quickNotes while keeping valid dailyGoalMinutes', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 90 })
    await studyDb.settings.put({ key: 'quickNotes', value: 'not-an-array' })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 90,
      quickNotes: [],
      onboardingChecklistDismissed: false,
    })
  })

  it('filters non-string entries from quickNotes arrays', async () => {
    await studyDb.settings.put({
      key: 'quickNotes',
      value: ['ok', 1, null, 'also', { x: 1 }],
    })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 240,
      quickNotes: ['ok', 'also'],
      onboardingChecklistDismissed: false,
    })
  })

  it('falls back malformed onboarding dismissal while keeping other values', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['one'] })
    await studyDb.settings.put({ key: 'onboardingChecklistDismissed', value: 'yes' })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 120,
      quickNotes: ['one'],
      onboardingChecklistDismissed: false,
    })
  })

  it('ignores unrelated settings keys when reading UI settings', async () => {
    await studyDb.settings.put({ key: 'dailyGoalMinutes', value: 120 })
    await studyDb.settings.put({ key: 'quickNotes', value: ['one'] })
    await studyDb.settings.put({ key: 'activeFocusSession', value: { id: 'focus-1' } })
    await studyDb.settings.put({ key: 'legacy-localstorage-migrated-v1', value: true })
    await studyDb.settings.put({ key: 'unknownFuture', value: { n: 1 } })

    await expect(getUiSettings()).resolves.toEqual({
      dailyGoalMinutes: 120,
      quickNotes: ['one'],
      onboardingChecklistDismissed: false,
    })
  })
})
