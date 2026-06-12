import './testUtils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SoundFeedbackPanel } from '../SoundFeedbackPanel'
import { SettingsPanelProvider } from '../SettingsPanelContext'
import { mockUpdateSetting } from './testUtils'

vi.mock('../../../lib/ambientAudio', () => ({
  getSharedAudioContext: vi.fn(),
}))

describe('SoundFeedbackPanel', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear()
  })

  it('renders session chimes and ambient controls', async () => {
    const user = userEvent.setup()
    render(
      <SettingsPanelProvider>
        <SoundFeedbackPanel />
      </SettingsPanelProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByText('Session chimes')).toBeInTheDocument()
    expect(screen.getByText('Ambient background')).toBeInTheDocument()
  })

  it('toggles ambient background setting', async () => {
    const user = userEvent.setup()
    render(
      <SettingsPanelProvider>
        <SoundFeedbackPanel />
      </SettingsPanelProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show' }))
    await user.click(screen.getByRole('switch', { name: /ambient background/i }))

    expect(mockUpdateSetting).toHaveBeenCalledWith('ambientSoundEnabled', true)
  })
})