import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrollToSettingsSectionWhenReady, queueSettingsPanelScroll, consumePendingSettingsPanelScroll } from '../settingsSections'

describe('scrollToSettingsSectionWhenReady', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls once the target element appears', async () => {
    const scrollIntoView = vi.fn()
    let attempts = 0

    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      attempts += 1
      if (attempts < 3) return null
      return { scrollIntoView } as unknown as HTMLElement
    })

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 0
    })

    let found = false
    scrollToSettingsSectionWhenReady('settings-timer-focus', result => {
      found = result
    })

    expect(found).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('reports false when the target never appears', () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 0
    })

    let found = true
    scrollToSettingsSectionWhenReady('missing-panel', result => {
      found = result
    })

    expect(found).toBe(false)
  })

  it('leaves pending scroll for ControlDeck when target is not ready yet', () => {
    sessionStorage.removeItem('pending_settings_scroll')
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)

    queueSettingsPanelScroll('settings-flashcards')
    scrollToSettingsSectionWhenReady('settings-flashcards')

    expect(sessionStorage.getItem('pending_settings_scroll')).toBe('settings-flashcards')
    expect(consumePendingSettingsPanelScroll()).toBe('settings-flashcards')
  })
})
