import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  dismissOnboardingChecklist,
  normalizeOnboardingChecklistDismissed,
  ONBOARDING_CHECKLIST_DISMISSED_KEY,
  showOnboardingChecklist,
} from './onboardingChecklistPreference'
import { studyDb } from './studyDb'

describe('onboardingChecklistPreference', () => {
  beforeEach(async () => {
    await studyDb.delete()
    await studyDb.open()
  })

  afterEach(async () => {
    if (studyDb.isOpen()) studyDb.close()
    await studyDb.delete()
  })

  it('defaults to not dismissed and treats malformed values as visible', () => {
    expect(normalizeOnboardingChecklistDismissed(undefined)).toBe(false)
    expect(normalizeOnboardingChecklistDismissed(false)).toBe(false)
    expect(normalizeOnboardingChecklistDismissed('true')).toBe(false)
    expect(normalizeOnboardingChecklistDismissed({})).toBe(false)
  })

  it('treats a stored true value as dismissed', () => {
    expect(normalizeOnboardingChecklistDismissed(true)).toBe(true)
  })

  it('persists dismissal and allows repeated dismiss calls', async () => {
    await dismissOnboardingChecklist()
    await dismissOnboardingChecklist()

    await expect(studyDb.settings.get(ONBOARDING_CHECKLIST_DISMISSED_KEY)).resolves.toEqual({
      key: ONBOARDING_CHECKLIST_DISMISSED_KEY,
      value: true,
    })
  })

  it('clears dismissal for restart and allows repeated show calls', async () => {
    await dismissOnboardingChecklist()

    await showOnboardingChecklist()
    await showOnboardingChecklist()

    await expect(studyDb.settings.get(ONBOARDING_CHECKLIST_DISMISSED_KEY)).resolves.toBeUndefined()
  })
})
