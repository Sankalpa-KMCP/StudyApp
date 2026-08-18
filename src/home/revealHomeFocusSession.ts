/** Stable DOM id for the Home FocusCard — used by dashboard recommendation and Quick add. */
export const HOME_FOCUS_SESSION_ID = 'home-focus-session'

/**
 * Scroll the existing FocusCard into view and move keyboard focus to its primary control.
 * Does not start, pause, resume, stop, or otherwise mutate the session.
 */
export function revealHomeFocusSession(): void {
  const focusCard = document.getElementById(HOME_FOCUS_SESSION_ID)
  if (!focusCard) return

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (typeof focusCard.scrollIntoView === 'function') {
    focusCard.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  const buttons = Array.from(
    focusCard.querySelectorAll<HTMLButtonElement>('button.primary-command, button.session-button'),
  )
  const enabled = buttons.find((button) => !button.disabled)
  // Prefer an enabled control; otherwise focus the labelled card rather than a disabled button.
  const target = enabled ?? focusCard
  target.focus()
}
