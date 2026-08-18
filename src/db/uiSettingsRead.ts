import { studyDb } from './studyDb'
import {
  normalizeOnboardingChecklistDismissed,
  ONBOARDING_CHECKLIST_DISMISSED_KEY,
} from './onboardingChecklistPreference'

const DAILY_GOAL_MINUTES_KEY = 'dailyGoalMinutes'
const QUICK_NOTES_KEY = 'quickNotes'
const DEFAULT_DAILY_GOAL_MINUTES = 240

/**
 * Normalized UI settings for the App-owned live query.
 * Reads only `dailyGoalMinutes` and `quickNotes` by primary key so focus, migration,
 * and unknown settings mutations are not observed. Full settings snapshots stay on `getStudyData`.
 */
export type UiSettings = {
  dailyGoalMinutes: number
  quickNotes: string[]
  onboardingChecklistDismissed: boolean
}

export const EMPTY_UI_SETTINGS: UiSettings = {
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  quickNotes: [],
  onboardingChecklistDismissed: false,
}

function normalizeDailyGoalMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_DAILY_GOAL_MINUTES
}

function normalizeQuickNotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** App UI settings reader — two keyed gets with the same fallbacks formerly applied in App. */
export async function getUiSettings(): Promise<UiSettings> {
  const [dailyGoalRecord, quickNotesRecord, onboardingDismissedRecord] = await Promise.all([
    studyDb.settings.get(DAILY_GOAL_MINUTES_KEY),
    studyDb.settings.get(QUICK_NOTES_KEY),
    studyDb.settings.get(ONBOARDING_CHECKLIST_DISMISSED_KEY),
  ])

  return {
    dailyGoalMinutes: normalizeDailyGoalMinutes(dailyGoalRecord?.value),
    quickNotes: normalizeQuickNotes(quickNotesRecord?.value),
    onboardingChecklistDismissed: normalizeOnboardingChecklistDismissed(onboardingDismissedRecord?.value),
  }
}
