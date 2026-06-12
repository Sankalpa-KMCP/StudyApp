import './testUtils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPanelProvider } from '../SettingsPanelContext'
import { AlgorithmPanel } from '../AlgorithmPanel'
import { ZenLockoutPanel } from '../ZenLockoutPanel'
import { NotesSettingsPanel } from '../NotesSettingsPanel'
import { BackupVaultPanel } from '../BackupVaultPanel'
import { FlashcardsPanel } from '../FlashcardsPanel'
import { DesktopSettingsPanel } from '../DesktopSettingsPanel'
import * as tauri from '../../../lib/desktop/tauri'
import { SettingsOnboardingBanners } from '../SettingsOnboardingBanners'
import { SettingsShell, SettingsSection } from '../SettingsShell'

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('control-deck panel smoke tests', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders AlgorithmPanel', () => {
    render(
      <SettingsPanelProvider>
        <AlgorithmPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Spaced Repetition')).toBeInTheDocument()
  })

  it('renders ZenLockoutPanel', () => {
    render(
      <SettingsPanelProvider>
        <ZenLockoutPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Focus lockout')).toBeInTheDocument()
    expect(screen.getByText('Automated Archiving')).toBeInTheDocument()
  })

  it('renders NotesSettingsPanel', () => {
    render(
      <SettingsPanelProvider>
        <NotesSettingsPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('renders BackupVaultPanel', () => {
    render(
      <SettingsPanelProvider>
        <BackupVaultPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Backup Vault')).toBeInTheDocument()
  })

  it('renders SettingsOnboardingBanners', () => {
    render(
      <SettingsOnboardingBanners
        dailyGoalMinutes={480}
        flashcardsEnabled={false}
      />,
    )
    expect(screen.getByText('Setup checklist')).toBeInTheDocument()
    expect(screen.getByText(/8h is a lot for day one/i)).toBeInTheDocument()
  })

  it('renders SettingsShell with section', () => {
    render(
      <SettingsShell>
        <SettingsSection id="focus" label="Timer & Focus">
          <p>Panel content</p>
        </SettingsSection>
      </SettingsShell>,
    )
    expect(screen.getByText('Timer & Focus')).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('renders DesktopSettingsPanel when Tauri is available', async () => {
    const user = userEvent.setup()
    vi.spyOn(tauri, 'isTauri').mockReturnValue(true)
    render(
      <SettingsPanelProvider>
        <DesktopSettingsPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Desktop App')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByText('Launch on login')).toBeInTheDocument()
    vi.mocked(tauri.isTauri).mockRestore()
  })

  it('renders FlashcardsPanel', () => {
    render(
      <SettingsPanelProvider>
        <FlashcardsPanel />
      </SettingsPanelProvider>,
    )
    expect(screen.getByText('Flashcards Settings')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable flashcards' })).toBeInTheDocument()
  })
})
