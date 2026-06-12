export const FIRST_SESSION_KEY = 'focus_first_run_pending'
export const FIRST_SESSION_CHANGED_EVENT = 'focus-first-session-changed'

export function markFirstSessionPending(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FIRST_SESSION_KEY, 'true')
  window.dispatchEvent(new CustomEvent(FIRST_SESSION_CHANGED_EVENT))
}

export function clearFirstSessionPending(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(FIRST_SESSION_KEY)
  window.dispatchEvent(new CustomEvent(FIRST_SESSION_CHANGED_EVENT))
}

export function isFirstSessionPending(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(FIRST_SESSION_KEY) === 'true'
}
