export const DAILY_GOAL_CONFIGURED_KEY = 'daily_goal_configured'
export const BACKUP_EXPORTED_EVENT = 'study-backup-exported'

export function isDailyGoalConfigured(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem(DAILY_GOAL_CONFIGURED_KEY)
}

export function markDailyGoalConfigured(): void {
  localStorage.setItem(DAILY_GOAL_CONFIGURED_KEY, 'true')
}
