import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsOnboardingBanners } from '../SettingsOnboardingBanners'

describe('SettingsOnboardingBanners', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders setup checklist by default', () => {
    render(
      <SettingsOnboardingBanners
        dailyGoalMinutes={120}
        flashcardsEnabled={false}
        onShowOnboarding={vi.fn()}
      />,
    )
    expect(screen.getByText('Setup checklist')).toBeInTheDocument()
  })

  it('shows replay card after dismiss without crashing', async () => {
    const user = userEvent.setup()
    const onShowOnboarding = vi.fn()
    render(
      <SettingsOnboardingBanners
        dailyGoalMinutes={120}
        flashcardsEnabled={false}
        onShowOnboarding={onShowOnboarding}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss checklist' }))

    expect(screen.queryByText('Setup checklist')).not.toBeInTheDocument()
    expect(screen.getByText('Replay the Getting Started tour')).toBeInTheDocument()
  })
})
