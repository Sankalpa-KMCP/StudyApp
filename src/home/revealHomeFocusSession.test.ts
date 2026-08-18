import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOME_FOCUS_SESSION_ID, revealHomeFocusSession } from './revealHomeFocusSession'

describe('revealHomeFocusSession', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="${HOME_FOCUS_SESSION_ID}" tabindex="-1">
        <button class="primary-command session-button" type="button">Start focus</button>
        <button class="session-button" type="button" disabled>Hidden</button>
      </section>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('scrolls the FocusCard and focuses the enabled primary control', () => {
    const card = document.getElementById(HOME_FOCUS_SESSION_ID) as HTMLElement
    const start = card.querySelector('button.primary-command') as HTMLButtonElement
    const scrollIntoView = vi.fn()
    card.scrollIntoView = scrollIntoView

    revealHomeFocusSession()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    expect(start).toHaveFocus()
  })

  it('prefers an enabled control when the primary button is disabled', () => {
    const card = document.getElementById(HOME_FOCUS_SESSION_ID) as HTMLElement
    const start = card.querySelector('button.primary-command') as HTMLButtonElement
    const secondary = card.querySelectorAll('button.session-button')[1] as HTMLButtonElement
    start.disabled = true
    secondary.disabled = false
    secondary.textContent = 'Resume session'
    card.scrollIntoView = vi.fn()

    revealHomeFocusSession()

    expect(secondary).toHaveFocus()
  })

  it('uses auto scroll behavior under prefers-reduced-motion', () => {
    const card = document.getElementById(HOME_FOCUS_SESSION_ID) as HTMLElement
    const scrollIntoView = vi.fn()
    card.scrollIntoView = scrollIntoView
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })

    revealHomeFocusSession()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
  })

  it('focuses the card when every session control is disabled', () => {
    const card = document.getElementById(HOME_FOCUS_SESSION_ID) as HTMLElement
    card.querySelectorAll('button').forEach((button) => {
      ;(button as HTMLButtonElement).disabled = true
    })
    card.scrollIntoView = vi.fn()

    revealHomeFocusSession()

    expect(card).toHaveFocus()
  })
})
