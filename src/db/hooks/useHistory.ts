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

export function useHistoryMutations() {
  return {
    addEntry: historyRepo.addHistoryEntry,
    clearHistory: historyRepo.clearHistory,
    isLoading: false,
  }
}

export function useRecentHistory(limit = 100) {
  const history = useLiveQuery(() => historyRepo.getRecentHistory(limit), [limit])

  return {
    history: history ?? [],
    isLoading: history === undefined,
  }
}

export function useHistoryForMonth(year: number, month: number) {
  const history = useLiveQuery(() => {
    const { start, end } = historyRepo.getMonthBounds(year, month)
    return historyRepo.getHistoryForDateRange(start, end)
  }, [year, month])

  return {
    history: history ?? [],
    isLoading: history === undefined,
  }
}
