export const PENDING_JOURNAL_DATE_KEY = 'pending_journal_date'

export function queueJournalDateNavigation(dateString: string): void {
  sessionStorage.setItem(PENDING_JOURNAL_DATE_KEY, dateString)
}

export function consumePendingJournalDate(): string | null {
  const date = sessionStorage.getItem(PENDING_JOURNAL_DATE_KEY)
  if (date) sessionStorage.removeItem(PENDING_JOURNAL_DATE_KEY)
  return date
}

export function parseJournalDateParts(dateString: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}
