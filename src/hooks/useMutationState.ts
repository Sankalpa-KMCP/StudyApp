import { useCallback, useEffect, useRef, useState } from 'react'
import { isDatabaseBackupabilityLimitError } from '../db/backupabilityGuard'
import { StaleDatabaseGenerationError } from '../db/databaseGeneration'

export type MutationPhase = 'idle' | 'pending' | 'success' | 'error'

export type MutationRunOptions = {
  successMessage?: string
  errorMessage: string
  onSuccess?: () => void
}

export type UseMutationStateResult = {
  phase: MutationPhase
  message: string | null
  isPending: boolean
  run: (action: () => Promise<void>, options: MutationRunOptions) => Promise<boolean>
  clearFeedback: () => void
}

export const STALE_GENERATION_MESSAGE =
  'The data changed in another window or during a database replacement; refresh or reopen this workflow before saving.'

export const DATABASE_CAPACITY_LIMIT_MESSAGE =
  'Study storage is at its backup-safe capacity. Remove or reduce some saved data before adding more.'

/**
 * Local async mutation helper for pending state, duplicate prevention, and
 * friendly success/error feedback. Does not reset forms or close editors.
 * Automatically catches and maps StaleDatabaseGenerationError and DatabaseBackupabilityLimitError to friendly user notices.
 */
export function useMutationState(): UseMutationStateResult {
  const [phase, setPhase] = useState<MutationPhase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearFeedback = useCallback(() => {
    if (pendingRef.current) return
    setPhase('idle')
    setMessage(null)
  }, [])

  const run = useCallback(async (action: () => Promise<void>, options: MutationRunOptions): Promise<boolean> => {
    if (pendingRef.current) return false

    pendingRef.current = true
    if (mountedRef.current) {
      setPhase('pending')
      setMessage(null)
    }

    try {
      await action()
      if (mountedRef.current) {
        setPhase('success')
        setMessage(options.successMessage ?? null)
      }
      options.onSuccess?.()
      return true
    } catch (error) {
      console.error(error)
      if (mountedRef.current) {
        setPhase('error')
        if (error instanceof StaleDatabaseGenerationError) {
          setMessage(STALE_GENERATION_MESSAGE)
        } else if (isDatabaseBackupabilityLimitError(error)) {
          setMessage(DATABASE_CAPACITY_LIMIT_MESSAGE)
        } else {
          setMessage(options.errorMessage)
        }
      }
      return false
    } finally {
      pendingRef.current = false
    }
  }, [])

  return {
    phase,
    message,
    isPending: phase === 'pending',
    run,
    clearFeedback,
  }
}
