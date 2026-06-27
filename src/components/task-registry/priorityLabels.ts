import type { TranslationKey } from '../../i18n'

export type TaskPriority = 'low' | 'medium' | 'high'

export const PRIORITY_LABEL_KEYS: Record<TaskPriority, TranslationKey> = {
  low: 'taskPriorityLow',
  medium: 'taskPriorityMedium',
  high: 'taskPriorityHigh',
}
