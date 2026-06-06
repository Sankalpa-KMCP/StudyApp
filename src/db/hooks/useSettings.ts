import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { SettingsKey, SettingsValue } from '../types'
import { settingsFromRows } from '../selectors/settingsFromRows'
import * as settingsRepo from '../repositories/settings'

export function useSettings() {
  const rows = useLiveQuery(() => db.settings.toArray())
  const parsed = settingsFromRows(rows)

  const updateSetting = async (key: SettingsKey, value: SettingsValue) => {
    await settingsRepo.updateSetting(key, value)
  }

  return {
    ...parsed,
    updateSetting,
    isLoading: rows === undefined,
  }
}
