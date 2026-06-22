export const SETTINGS_SHOW_ADVANCED_KEY = 'settings_show_advanced'
export const SETTINGS_ADVANCED_CHANGED_EVENT = 'settings-advanced-changed'

export function readAdvancedSettingsMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SETTINGS_SHOW_ADVANCED_KEY) === 'true'
}

export function enableAdvancedSettings(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SETTINGS_SHOW_ADVANCED_KEY) === 'true') return
  localStorage.setItem(SETTINGS_SHOW_ADVANCED_KEY, 'true')
  window.dispatchEvent(new CustomEvent(SETTINGS_ADVANCED_CHANGED_EVENT, { detail: true }))
}
