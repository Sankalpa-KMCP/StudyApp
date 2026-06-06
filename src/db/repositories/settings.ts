import { db } from '../db'
import type { SettingsKey, SettingsValue } from '../types'

export async function updateSetting(key: SettingsKey, value: SettingsValue) {
  await db.settings.put({ key, value })
}

export async function getInitialEasinessFactor(): Promise<number> {
  const settings = await db.settings.toArray()
  return (settings.find(r => r.key === 'initialEasinessFactor')?.value as number) ?? 2.5
}
