import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
): T & { flush: () => void; cancel: () => void } {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArgsRef = useRef<Parameters<T> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingArgsRef.current = null
  }, [])

  const flush = useCallback(() => {
    if (!pendingArgsRef.current) return
    const args = pendingArgsRef.current
    pendingArgsRef.current = null
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    callbackRef.current(...args)
  }, [])

  const debounced = useCallback((...args: Parameters<T>) => {
    pendingArgsRef.current = args
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      pendingArgsRef.current = null
      callbackRef.current(...args)
    }, delayMs)
  }, [delayMs]) as T & { flush: () => void; cancel: () => void }

  debounced.flush = flush
  debounced.cancel = cancel

  useEffect(() => () => cancel(), [cancel])

  return debounced
}
