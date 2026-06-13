import type React from 'react'
import { Clock, BarChart3, Calendar, Settings } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { t } from '../i18n'

export const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

export function getNavTabs(): {
  id: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  color: string
  accent: ActiveTab
}[] {
  return [
    { id: 'focus', label: t('navFocus'), icon: Clock, color: 'text-accent-blue', accent: 'focus' },
    { id: 'analytics', label: t('navAnalytics'), icon: BarChart3, color: 'text-accent-green', accent: 'analytics' },
    { id: 'journal', label: t('navJournal'), icon: Calendar, color: 'text-accent-amber', accent: 'journal' },
    { id: 'settings', label: t('navSettings'), icon: Settings, color: 'text-secondary', accent: 'settings' },
  ]
}

export function getTabChrome(): Record<ActiveTab, { title: string; subtitle: string }> {
  return {
    focus: { title: t('navFocus'), subtitle: t('navFocusSubtitle') },
    analytics: { title: t('navAnalytics'), subtitle: t('navAnalyticsSubtitle') },
    journal: { title: t('navJournal'), subtitle: t('journalTabSubtitle') },
    settings: { title: t('navSettings'), subtitle: t('navSettingsSubtitle') },
  }
}

export const ACTIVE_TAB_IDS: ActiveTab[] = ['focus', 'analytics', 'journal', 'settings']

export const KEYBOARD_TAB_ORDER: ActiveTab[] = ACTIVE_TAB_IDS
