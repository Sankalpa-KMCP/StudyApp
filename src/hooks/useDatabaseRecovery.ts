import { deleteAndReopen, getSchemaVersion } from '../db/repositories/database'

export function useDatabaseRecovery() {
  return {
    getSchemaVersion,
    deleteAndReopen,
  }
}
