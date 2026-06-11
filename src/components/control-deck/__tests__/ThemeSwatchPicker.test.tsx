import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSwatchPicker } from '../ThemeSwatchPicker'

describe('ThemeSwatchPicker', () => {
  it('selects a light preset when swatch is clicked', async () => {
    const user = userEvent.setup()
    const updateSetting = vi.fn()
    render(
      <ThemeSwatchPicker
        theme="midnight-slate"
        themePreset="midnight-slate"
        lightThemePreset="paper-day"
        updateSetting={updateSetting}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Linen Warm' }))
    expect(updateSetting).toHaveBeenCalledWith('theme', 'linen-warm')
    expect(updateSetting).toHaveBeenCalledWith('themePreset', 'linen-warm')
    expect(updateSetting).toHaveBeenCalledWith('lightThemePreset', 'linen-warm')
  })

  it('shows system dark and light preset pickers in system mode', () => {
    render(
      <ThemeSwatchPicker
        theme="system"
        themePreset="midnight-slate"
        lightThemePreset="paper-day"
        updateSetting={vi.fn()}
      />,
    )
    expect(screen.getByText('System dark preset')).toBeInTheDocument()
    expect(screen.getByText('System light preset')).toBeInTheDocument()
  })

  it('selects system mode when Match system is clicked', async () => {
    const user = userEvent.setup()
    const updateSetting = vi.fn()
    render(
      <ThemeSwatchPicker
        theme="midnight-slate"
        themePreset="midnight-slate"
        lightThemePreset="paper-day"
        updateSetting={updateSetting}
      />,
    )

    await user.click(screen.getByRole('button', { name: /match system/i }))
    expect(updateSetting).toHaveBeenCalledWith('theme', 'system')
  })
})
