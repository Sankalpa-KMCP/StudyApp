import type React from 'react'
import { Clock, BarChart3, Calendar, Settings } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { JOURNAL_TAB_SUBTITLE } from '../lib/shared/uxTerms'

export const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

export const NAV_TABS: {
  id: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  color: string
  accent: ActiveTab
}[] = [
  { id: 'focus', label: 'Focus', icon: Clock, color: 'text-accent-blue', accent: 'focus' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-accent-green', accent: 'analytics' },
  { id: 'journal', label: 'Journal', icon: Calendar, color: 'text-accent-amber', accent: 'journal' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-secondary', accent: 'settings' },
]

export const TAB_CHROME: Record<ActiveTab, { title: string; subtitle: string }> = {
  focus: { title: 'Focus', subtitle: 'Timer, focus targets, and focus mode' },
  analytics: { title: 'Analytics', subtitle: 'Study insights and retention trends' },
  journal: { title: 'Journal', subtitle: JOURNAL_TAB_SUBTITLE },
  settings: { title: 'Settings', subtitle: 'Preferences, backup, and themes' },
}

export const ACTIVE_TAB_IDS: ActiveTab[] = NAV_TABS.map(tab => tab.id)

export const KEYBOARD_TAB_ORDER: ActiveTab[] = NAV_TABS.map(t => t.id)
