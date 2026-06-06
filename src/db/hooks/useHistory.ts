import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import * as historyRepo from '../repositories/history'

export function useHistory() {
  const history = useLiveQuery(() => db.history.orderBy('id').reverse().toArray())

  return {
    history: history ?? [],
    addEntry: historyRepo.addHistoryEntry,
    clearHistory: historyRepo.clearHistory,
    isLoading: history === undefined,
  }
}
