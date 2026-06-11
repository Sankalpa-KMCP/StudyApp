import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MobileTabBar } from '../MobileTabBar'

describe('MobileTabBar', () => {
  it('does not auto-focus the active tab when activeTab changes programmatically', () => {
    const setActiveTab = vi.fn()
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {})

    const { rerender } = render(
      <MobileTabBar
        activeTab="focus"
        setActiveTab={setActiveTab}
        isTimerActive={false}
        timerMode="study"
        enforceLockout={false}
      />,
    )

    focusSpy.mockClear()

    rerender(
      <MobileTabBar
        activeTab="journal"
        setActiveTab={setActiveTab}
        isTimerActive={false}
        timerMode="study"
        enforceLockout={false}
      />,
    )

    expect(focusSpy).not.toHaveBeenCalled()
    focusSpy.mockRestore()
  })
})
