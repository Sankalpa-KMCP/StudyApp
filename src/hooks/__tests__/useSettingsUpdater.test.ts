import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsUpdater } from '../useSettingsUpdater'

const mockUpdateSetting = vi.fn()

vi.mock('../../db/hooks/useSettings', () => ({
  useSettings: () => ({
    dailyGoalMinutes: 120,
    updateSetting: mockUpdateSetting,
    isLoading: false,
  }),
}))

describe('useSettingsUpdater', () => {
  const pushToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateSetting.mockResolvedValue(undefined)
  })

  it('clamps and saves valid numeric settings', async () => {
    const { result } = renderHook(() => useSettingsUpdater(pushToast))

    await act(async () => {
      await result.current.updateSettingSafe('dailyGoalMinutes', 45)
    })

    expect(mockUpdateSetting).toHaveBeenCalledWith('dailyGoalMinutes', 60)
    expect(pushToast).not.toHaveBeenCalled()
  })

  it('shows toast on validation failure', async () => {
    const { result } = renderHook(() => useSettingsUpdater(pushToast))

    await act(async () => {
      await result.current.updateSettingSafe('soundEnabled', 'yes' as never)
    })

    expect(mockUpdateSetting).not.toHaveBeenCalled()
    expect(pushToast).toHaveBeenCalledWith('SETTINGS', expect.stringContaining('boolean'))
  })

  it('shows toast on save failure', async () => {
    mockUpdateSetting.mockRejectedValueOnce(new Error('db'))
    const { result } = renderHook(() => useSettingsUpdater(pushToast))

    await act(async () => {
      await result.current.updateSettingSafe('dailyGoalMinutes', 120)
    })

    expect(pushToast).toHaveBeenCalledWith('SETTINGS', 'Could not save setting — try again')
  })

  it('resets section defaults with success toast', async () => {
    const { result } = renderHook(() => useSettingsUpdater(pushToast))

    await act(async () => {
      await result.current.resetSectionDefaults('focus')
    })

    expect(mockUpdateSetting).toHaveBeenCalled()
    expect(pushToast).toHaveBeenCalledWith('SETTINGS', 'Focus settings restored')
  })
})
