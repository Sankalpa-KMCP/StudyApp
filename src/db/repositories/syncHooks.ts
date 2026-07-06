import { db } from '../db'

let hooksRegistered = false

export function registerSyncDbHooks(onChange: () => void): void {
  if (hooksRegistered) return
  hooksRegistered = true

  const tables = [
    db.tasks,
    db.history,
    db.daily_logs,
    db.categories,
    db.quick_notes,
  ] as const

  for (const table of tables) {
    table.hook('creating', onChange)
    table.hook('updating', onChange)
    table.hook('deleting', onChange)
  }

  db.settings.hook('creating', (_pk, obj) => {
    if (obj.key === 'lastSyncAt' || obj.key === 'lastSyncChecksum') return
    onChange()
  })
  db.settings.hook('updating', (mods, _pk, obj) => {
    const key = obj.key
    if (key === 'lastSyncAt' || key === 'lastSyncChecksum') return
    const changes = mods as Partial<{ value: unknown }>
    if (changes.value !== undefined) onChange()
  })
  db.settings.hook('deleting', (_pk, obj) => {
    if (obj.key === 'lastSyncAt' || obj.key === 'lastSyncChecksum') return
    onChange()
  })
}
