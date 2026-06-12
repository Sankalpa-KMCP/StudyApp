/**
 * Utility functions for interacting with the Screen Wake Lock API.
 * This keeps the screen awake during active study/focus sessions.
 * Browsers release the lock when the document is hidden; callers should
 * re-request on visibilitychange when the timer is active again.
 */

import { devLog } from './devLogger'

export function isWakeLockSupported(): boolean {
  return typeof window !== 'undefined' && 'wakeLock' in navigator
}

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!isWakeLockSupported()) {
    devLog('wakeLock', 'unsupported')
    return null
  }

  try {
    const wakeLock = await navigator.wakeLock.request('screen')
    devLog('wakeLock', 'acquired')
    return wakeLock
  } catch (err) {
    console.error('Failed to acquire Screen Wake Lock:', err)
    return null
  }
}

export async function releaseWakeLock(sentinel: WakeLockSentinel | null): Promise<void> {
  if (!sentinel) return

  try {
    await sentinel.release()
    devLog('wakeLock', 'released')
  } catch (err) {
    console.error('Failed to release Screen Wake Lock:', err)
  }
}
