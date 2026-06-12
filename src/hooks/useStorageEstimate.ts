import { useState, useEffect } from 'react'
import { db } from '../db/db'

export interface TableRowCounts {
  tasks: number
  history: number
  dailyLogs: number
  flashcards: number
  quickNotes: number
  categories: number
  snapshots: number
}

export interface StorageEstimate {
  usageBytes: number | null
  quotaBytes: number | null
  rowCounts: TableRowCounts | null
  isLoading: boolean
  isSupported: boolean
}

async function fetchRowCounts(): Promise<TableRowCounts> {
  const [tasks, history, dailyLogs, flashcards, quickNotes, categories, snapshots] = await Promise.all([
    db.tasks.count(),
    db.history.count(),
    db.daily_logs.count(),
    db.flashcards.count(),
    db.quick_notes.count(),
    db.categories.count(),
    db.snapshots.count(),
  ])
  return { tasks, history, dailyLogs, flashcards, quickNotes, categories, snapshots }
}

export function useStorageEstimate(enabled = true): StorageEstimate {
  const [usageBytes, setUsageBytes] = useState<number | null>(null)
  const [quotaBytes, setQuotaBytes] = useState<number | null>(null)
  const [rowCounts, setRowCounts] = useState<TableRowCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.estimate === 'function'

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const counts = await fetchRowCounts()
        if (cancelled) return
        setRowCounts(counts)

        if (isSupported) {
          const estimate = await navigator.storage.estimate()
          if (cancelled) return
          setUsageBytes(estimate.usage ?? null)
          setQuotaBytes(estimate.quota ?? null)
        }
      } catch {
        if (!cancelled) {
          setRowCounts(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [enabled, isSupported])

  return { usageBytes, quotaBytes, rowCounts, isLoading, isSupported }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
