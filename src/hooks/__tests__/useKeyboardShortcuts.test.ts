import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  const setActiveToast = vi.fn()
  const completeSession = vi.fn().mockResolvedValue('reflection' as const)
  const requestConfirm = vi.fn().mockResolvedValue(true)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderShortcuts(overrides: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {}) {
    return renderHook(() =>
      useKeyboardShortcuts({
        activeTab: 'focus',
        isHotkeyHudOpen: false,
        isTimerActive: true,
        timerMode: 'study',
        enforceLockout: false,
        showReflectionModal: false,
        secondsElapsedRef: { current: 30 },
        completingRef: { current: false },
        handleModeSwitch: vi.fn(),
        completeSession,
        setIsTimerActive: vi.fn(),
        setIsZenMode: vi.fn(),
        setIsHotkeyHudOpen: vi.fn(),
        setActiveToast,
        requestConfirm,
        ...overrides,
      }),
    )
  }

  it('blocks timer shortcuts while reflection modal is open', () => {
    renderShortcuts({ showReflectionModal: true })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(setActiveToast).not.toHaveBeenCalled()
  })

  it('requires confirm before completing a short session', async () => {
    renderShortcuts({ secondsElapsedRef: { current: 10 } })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }))
    })
    await vi.waitFor(() => {
      expect(requestConfirm).toHaveBeenCalled()
    })
  })

  it('allows timer shortcuts on Settings tab when timer is active', () => {
    const setIsTimerActive = vi.fn()
    renderShortcuts({ activeTab: 'settings', setIsTimerActive })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(setIsTimerActive).toHaveBeenCalled()
  })

  it('routes number-key tab jumps through lockout-aware navigation', () => {
    const navigateToTab = vi.fn()
    renderShortcuts({ navigateToTab })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
    })
    expect(navigateToTab).toHaveBeenCalledWith('cards')
  })

  it('remaps number keys when visibleTabs is overridden', () => {
    const navigateToTab = vi.fn()
    renderShortcuts({
      navigateToTab,
      visibleTabs: ['focus', 'analytics', 'journal', 'settings'],
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
    })
    expect(navigateToTab).toHaveBeenCalledWith('analytics')

    vi.clearAllMocks()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }))
    })
    expect(navigateToTab).not.toHaveBeenCalled()
  })
})
