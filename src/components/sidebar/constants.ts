import type React from 'react'
import { Clock, BarChart3, Calendar, Settings, Layers } from 'lucide-react'
import type { ActiveTab } from '../../types/app'

export const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

export const NAV_TABS: {
  id: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  color: string
}[] = [
  { id: 'focus', label: 'Focus', icon: Clock, color: 'text-accent-blue' },
  { id: 'cards', label: 'Cards', icon: Layers, color: 'text-accent-purple' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-accent-green' },
  { id: 'journal', label: 'Journal', icon: Calendar, color: 'text-accent-amber' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-white/60' },
]
