import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AestheticsPanel } from '../AestheticsPanel'

const baseProps = {
  theme: 'midnight-slate',
  themePreset: 'midnight-slate',
  lightThemePreset: 'paper-day',
  uiFont: 'Inter',
  uiDensity: 'comfortable' as const,
  cardOpacity: 0.7,
  backdropBlur: 8,
  backdropSaturate: 180,
  cardBorderOpacity: 0.08,
  accentBlueOverride: '#ff0000',
  accentPurpleOverride: null,
  accentGreenOverride: null,
  accentAmberOverride: null,
  updateSetting: vi.fn(),
}

describe('AestheticsPanel', () => {
  it('resets accent override to preset', async () => {
    const user = userEvent.setup()
    const updateSetting = vi.fn()
    render(<AestheticsPanel {...baseProps} updateSetting={updateSetting} />)

    await user.click(screen.getByRole('button', { name: /reset to preset/i }))
    expect(updateSetting).toHaveBeenCalledWith('accentBlueOverride', null)
  })

  it('shows dark and light preset dropdowns in system mode', () => {
    render(<AestheticsPanel {...baseProps} theme="system" />)
    expect(screen.getByText('Dark preset')).toBeInTheDocument()
    expect(screen.getByText('Light preset')).toBeInTheDocument()
  })
})
