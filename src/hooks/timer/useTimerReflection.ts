import { useState, useCallback } from 'react'
import type { PendingSessionData } from '../../types/app'

interface UseTimerReflectionOptions {
  completingRef: React.MutableRefObject<boolean>
  processSessionCompletion: (
    elapsed: number,
    mode: 'study' | 'break',
    timestamp: string,
    categoryId?: number,
    attRating?: number,
    stabRating?: number,
    sessionNotes?: string,
  ) => Promise<void>
}

export function useTimerReflection({ completingRef, processSessionCompletion }: UseTimerReflectionOptions) {
  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [pendingSessionData, setPendingSessionData] = useState<PendingSessionData | null>(null)
  const [attentionRating, setAttentionRating] = useState(4)
  const [stabilityRating, setStabilityRating] = useState(4)
  const [localSessionNotes, setLocalSessionNotes] = useState('')

  const openReflection = useCallback((data: PendingSessionData) => {
    setPendingSessionData(data)
    setAttentionRating(4)
    setStabilityRating(4)
    setLocalSessionNotes('')
    setShowReflectionModal(true)
  }, [])

  const submitReflection = useCallback(async (
    att: number,
    stab: number,
    notes: string,
    customElapsed?: number,
  ) => {
    setShowReflectionModal(false)
    const data = pendingSessionData
    setPendingSessionData(null)
    if (!data) return
    completingRef.current = true
    const finalElapsed = customElapsed !== undefined ? customElapsed : data.elapsed
    await processSessionCompletion(finalElapsed, data.mode, data.timestamp, data.categoryId, att, stab, notes)
  }, [pendingSessionData, processSessionCompletion, completingRef])

  const skipReflection = useCallback(async (customElapsed?: number) => {
    await submitReflection(4, 4, '', customElapsed)
  }, [submitReflection])

  return {
    showReflectionModal,
    setShowReflectionModal,
    pendingSessionData,
    setPendingSessionData,
    attentionRating,
    setAttentionRating,
    stabilityRating,
    setStabilityRating,
    localSessionNotes,
    setLocalSessionNotes,
    openReflection,
    submitReflection,
    skipReflection,
  }
}
