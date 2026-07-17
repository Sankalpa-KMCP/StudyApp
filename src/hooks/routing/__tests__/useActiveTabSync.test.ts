import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActiveTabSync } from '../useActiveTabSync'

const {
  writeAppHash,
  readAppHashFromLocation,
  resolveAppHash,
  setActiveTabSync,
} = vi.hoisted(() => ({
  writeAppHash: vi.fn(),
  readAppHashFromLocation: vi.fn(() => ({ tab: 'focus' as const })),
  resolveAppHash: vi.fn((tab: string) => tab),
  setActiveTabSync: vi.fn(),
}))

vi.mock('../../../lib/routing/appHashRouting', () => ({
  writeAppHash,
  readAppHashFromLocation,
  resolveAppHash,
}))

vi.mock('../../../lib/routing/activeTabSync', () => ({
  setActiveTabSync,
}))

describe('useActiveTabSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readAppHashFromLocation.mockReturnValue({ tab: 'focus' })
    resolveAppHash.mockImplementation(tab => tab)
  })

  it('syncs active tab to hash and external store on change', () => {
    const navigateToTab = vi.fn()
    const { rerender } = renderHook(
      ({ activeTab }) => useActiveTabSync({ activeTab, navigateToTab }),
      { initialProps: { activeTab: 'focus' as const } },
    )

    expect(setActiveTabSync).toHaveBeenCalledWith('focus')
    expect(writeAppHash).toHaveBeenCalledWith('focus')

    rerender({ activeTab: 'analytics' })

    expect(setActiveTabSync).toHaveBeenCalledWith('analytics')
    expect(writeAppHash).toHaveBeenCalledWith('analytics')
  })

  it('navigates when hash changes to a different tab', () => {
    const navigateToTab = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useActiveTabSync({ activeTab: 'focus', navigateToTab }))

    readAppHashFromLocation.mockReturnValue({ tab: 'journal' })
    resolveAppHash.mockReturnValue('journal')

    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(navigateToTab).toHaveBeenCalledWith('journal')
  })
})
