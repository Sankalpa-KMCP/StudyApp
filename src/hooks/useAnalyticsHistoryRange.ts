import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAllHistoryOrderedByCreatedAt, getHistoryForDateRange } from '../db/repositories/history'
import { t } from '../i18n'

export type AnalyticsHistoryRange = '7d' | '30d' | '90d' | 'all'

const STORAGE_KEY = 'analytics_range'

const RANGE_MS: Record<Exclude<AnalyticsHistoryRange, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

const ANALYTICS_RANGE_LABEL_KEYS: Record<AnalyticsHistoryRange, 'analyticsRange7d' | 'analyticsRange30d' | 'analyticsRange90d' | 'analyticsRangeAll'> = {
  '7d': 'analyticsRange7d',
  '30d': 'analyticsRange30d',
  '90d': 'analyticsRange90d',
  all: 'analyticsRangeAll',
}

export function getAnalyticsRangeLabel(range: AnalyticsHistoryRange): string {
  return t(ANALYTICS_RANGE_LABEL_KEYS[range])
}

function readStoredRange(): AnalyticsHistoryRange {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw
  return '30d'
}

async function fetchHistoryForRange(range: AnalyticsHistoryRange) {
  if (range === 'all') {
    return getAllHistoryOrderedByCreatedAt()
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
    rangeLabel: getAnalyticsRangeLabel(range),
  }
}
