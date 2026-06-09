import type React from 'react'
import { Clock, BarChart3, Calendar, Settings, Layers } from 'lucide-react'
import type { ActiveTab } from '../types/app'

export const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

export const NAV_TABS: {
  id: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  color: string
  accent: ActiveTab
}[] = [
  { id: 'focus', label: 'Focus', icon: Clock, color: 'text-accent-blue', accent: 'focus' },
  { id: 'cards', label: 'Cards', icon: Layers, color: 'text-accent-purple', accent: 'cards' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-accent-green', accent: 'analytics' },
  { id: 'journal', label: 'Journal', icon: Calendar, color: 'text-accent-amber', accent: 'journal' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-white/60', accent: 'settings' },
]

export const TAB_CHROME: Record<ActiveTab, { title: string; subtitle: string }> = {
  focus: { title: 'Focus', subtitle: 'Timer, targets, and sanctuary mode' },
  cards: { title: 'Flashcards', subtitle: 'Active recall and spaced repetition' },
  analytics: { title: 'Analytics', subtitle: 'Study insights and retention trends' },
  journal: { title: 'Journal', subtitle: 'Daily logs and session history' },
  settings: { title: 'Settings', subtitle: 'Preferences, backup, and themes' },
}

export const ACTIVE_TAB_IDS: ActiveTab[] = NAV_TABS.map(tab => tab.id)
