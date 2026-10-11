import { DATABASE_GENERATION_KEY } from './databaseGeneration'
import type { StudySetting } from './types'

export const LEGACY_MIGRATION_KEY = 'legacy-localstorage-migrated-v1'

/** Only these implementation records are omitted from portable backups and capacity. */
export function isPortableStudySetting(setting: Pick<StudySetting, 'key'>): boolean {
  return setting.key !== DATABASE_GENERATION_KEY && setting.key !== LEGACY_MIGRATION_KEY
}
