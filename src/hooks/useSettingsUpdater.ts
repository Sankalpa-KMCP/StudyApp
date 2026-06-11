import { useCallback } from 'react'
import type { SettingsKey, SettingsValue } from '../db/types'
import { useSettings } from '../db/hooks/useSettings'
import type { useAppToast } from './useAppToast'
import { validateSetting } from '../lib/settingsValidation'
import {
  type SettingsSectionId,
  SECTION_DEFAULT_KEYS,
  getDefaultForKey,
} from '../lib/settingsSections'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

interface UpdateOptions {
  silent?: boolean
}

export function useSettingsUpdater(pushToast: PushToast) {
  const settings = useSettings()

  const updateSettingSafe = useCallback(async (
    key: SettingsKey,
    value: SettingsValue,
    options: UpdateOptions = {},
  ) => {
    const validated = validateSetting(key, value)
    if (validated.ok === false) {
      if (!options.silent) {
        pushToast('SETTINGS', `Could not save: ${validated.reason}`)
      }
      return false
    }
    try {
      await settings.updateSetting(key, validated.value)
      return true
    } catch {
      if (!options.silent) {
        pushToast('SETTINGS', 'Could not save setting — try again')
      }
      return false
    }
  }, [settings, pushToast])

  const resetKeysToDefaults = useCallback(async (
    keys: SettingsKey[],
    successMessage: string,
  ) => {
    try {
      await Promise.all(
        keys.map(key => settings.updateSetting(key, getDefaultForKey(key))),
      )
      pushToast('SETTINGS', successMessage)
      return true
    } catch {
      pushToast('SETTINGS', 'Could not restore defaults')
      return false
    }
  }, [settings, pushToast])

  const resetSectionDefaults = useCallback(async (sectionId: SettingsSectionId) => {
    const keys = SECTION_DEFAULT_KEYS[sectionId]
    if (keys.length === 0) return false
    const label = sectionId.charAt(0).toUpperCase() + sectionId.slice(1)
    return resetKeysToDefaults(keys, `${label} settings restored`)
  }, [resetKeysToDefaults])

  const resetKeys = useCallback(async (keys: SettingsKey[], successMessage: string) => {
    return resetKeysToDefaults(keys, successMessage)
  }, [resetKeysToDefaults])

  return {
    ...settings,
    updateSettingSafe,
    resetSectionDefaults,
    resetKeys,
  }
}
