import './testUtils'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerFocusPanel } from '../TimerFocusPanel'
import { SettingsPanelProvider } from '../SettingsPanelContext'
import { mockUpdateSetting } from './testUtils'

describe('TimerFocusPanel', () => {
  it('shows live timer summary', () => {
    render(
      <SettingsPanelProvider>
        <TimerFocusPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText(/25m focus · 5m break · 15m long · every 4 sessions/)).toBeInTheDocument()
  })

  it('applies classic pomodoro preset', async () => {
    const user = userEvent.setup()
    mockUpdateSetting.mockClear()
    render(
      <SettingsPanelProvider>
        <TimerFocusPanel />
      </SettingsPanelProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Classic' }))

    expect(mockUpdateSetting).toHaveBeenCalledWith('studyBlockDurationMinutes', 25)
    expect(mockUpdateSetting).toHaveBeenCalledWith('shortBreakDurationMinutes', 5)
    expect(mockUpdateSetting).toHaveBeenCalledWith('longBreakDurationMinutes', 15)
    expect(mockUpdateSetting).toHaveBeenCalledWith('targetSessionsPerCycle', 4)
  })
})
