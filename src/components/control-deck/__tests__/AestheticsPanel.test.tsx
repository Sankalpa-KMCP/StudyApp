import './testUtils'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AestheticsPanel } from '../AestheticsPanel'
import { SettingsPanelProvider } from '../SettingsPanelContext'
import { mockUpdateSetting } from './testUtils'

vi.mock('../../../context/useConfirm', () => ({
  useConfirm: () => ({ requestConfirm: vi.fn().mockResolvedValue(false) }),
}))

describe('AestheticsPanel', () => {
  it('resets accent override to preset', async () => {
    const user = userEvent.setup()
    render(
      <SettingsPanelProvider>
        <AestheticsPanel />
      </SettingsPanelProvider>,
    )

    await user.click(screen.getByRole('button', { name: /advanced glass/i }))
    await user.click(screen.getByRole('button', { name: /reset to preset/i }))
    expect(mockUpdateSetting).toHaveBeenCalledWith('accentBlueOverride', null)
  })

  it('renders aesthetics panel title', () => {
    render(
      <SettingsPanelProvider>
        <AestheticsPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Aesthetics & Translucency')).toBeInTheDocument()
  })
})
