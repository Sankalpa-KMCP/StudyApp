import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getHistoryForDateRange } from '../db/repositories/history'

export type AnalyticsHistoryRange = '7d' | '30d' | '90d' | 'all'

const STORAGE_KEY = 'analytics_range'

const RANGE_MS: Record<Exclude<AnalyticsHistoryRange, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsHistoryRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
}

function readStoredRange(): AnalyticsHistoryRange {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw
  return '30d'
}

async function fetchHistoryForRange(range: AnalyticsHistoryRange) {
  if (range === 'all') {
    return db.history.orderBy('createdAt').reverse().toArray()
  }
  const start = Date.now() - RANGE_MS[range]
  return getHistoryForDateRange(start, Date.now())
}

export function useAnalyticsHistoryRange(enabled = true) {
  const [range, setRangeState] = useState<AnalyticsHistoryRange>(readStoredRange)

  const setRange = useCallback((next: AnalyticsHistoryRange) => {
    localStorage.setItem(STORAGE_KEY, next)
    setRangeState(next)
  }, [])

  const history = useLiveQuery(
    () => (enabled ? fetchHistoryForRange(range) : Promise.resolve([])),
    [range, enabled],
  )

  return {
    range,
    setRange,
    history: history ?? [],
    isLoading: history === undefined,
    rangeLabel: ANALYTICS_RANGE_LABELS[range],
  }
}
