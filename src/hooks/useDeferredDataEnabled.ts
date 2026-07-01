import { useSyncExternalStore } from 'react'

type Listener = () => void

interface DeferredDataFlags {
  notesEnabled: boolean
  fullLogsEnabled: boolean
}

let flags: DeferredDataFlags = { notesEnabled: false, fullLogsEnabled: false }
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function setDeferredDataFlags(patch: Partial<DeferredDataFlags>) {
  const next = { ...flags, ...patch }
  if (next.notesEnabled === flags.notesEnabled && next.fullLogsEnabled === flags.fullLogsEnabled) return
  flags = next
  emit()
}

export function useDeferredDataFlags() {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => flags,
    () => ({ notesEnabled: false, fullLogsEnabled: false }),
  )
}

/** @deprecated Use setDeferredDataFlags */
export function setNotesDataEnabled(enabled: boolean) {
  setDeferredDataFlags({ notesEnabled: enabled })
}

/** @deprecated Use useDeferredDataFlags */
export function useNotesDataEnabled() {
  return useDeferredDataFlags().notesEnabled
}
