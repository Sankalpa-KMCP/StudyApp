import { studyDb } from './studyDb'

export const ONBOARDING_CHECKLIST_DISMISSED_KEY = 'onboardingChecklistDismissed'

export function normalizeOnboardingChecklistDismissed(value: unknown): boolean {
  return value === true
}

export async function dismissOnboardingChecklist(): Promise<void> {
  await studyDb.settings.put({
    key: ONBOARDING_CHECKLIST_DISMISSED_KEY,
    value: true,
  })
}

export async function showOnboardingChecklist(): Promise<void> {
  await studyDb.settings.delete(ONBOARDING_CHECKLIST_DISMISSED_KEY)
}
