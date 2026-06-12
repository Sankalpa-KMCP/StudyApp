import type { ActiveTab } from '../types/app'
import type { SettingsSectionId } from './settingsSections'

const TAB_IDS: ActiveTab[] = ['focus', 'analytics', 'journal', 'cards', 'settings']
const SETTINGS_SECTIONS: SettingsSectionId[] = ['appearance', 'focus', 'study', 'data']

export interface AppHashState {
  tab: ActiveTab
  settingsSection?: SettingsSectionId
}

export function parseAppHash(hash: string): AppHashState {
  const raw = hash.replace(/^#/, '').trim()
  if (!raw) return { tab: 'focus' }

  const [tabPart, sectionPart] = raw.split('/')
  const tab = TAB_IDS.includes(tabPart as ActiveTab) ? (tabPart as ActiveTab) : 'focus'

  if (tab !== 'settings' || !sectionPart) {
    return { tab }
  }

  const settingsSection = SETTINGS_SECTIONS.includes(sectionPart as SettingsSectionId)
    ? (sectionPart as SettingsSectionId)
    : undefined

  return { tab, settingsSection }
}

export function buildAppHash(tab: ActiveTab, settingsSection?: SettingsSectionId): string {
  if (tab === 'settings' && settingsSection) {
    return `#settings/${settingsSection}`
  }
  return `#${tab}`
}

export function readAppHashFromLocation(): AppHashState {
  if (typeof window === 'undefined') return { tab: 'focus' }
  return parseAppHash(window.location.hash)
}

export function writeAppHash(tab: ActiveTab, settingsSection?: SettingsSectionId) {
  if (typeof window === 'undefined') return
  const next = buildAppHash(tab, settingsSection)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}
