const MS_PER_DAY = 1000 * 60 * 60 * 24

export function shouldRunAutoExport(
  lastExportAt: number | null,
  intervalDays: number,
  now = Date.now(),
): boolean {
  if (intervalDays <= 0) return false
  if (lastExportAt === null) return true
  return (now - lastExportAt) / MS_PER_DAY >= intervalDays
}
