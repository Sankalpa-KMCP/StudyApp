import './testUtils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsPanelProvider } from '../SettingsPanelContext'
import { AlgorithmPanel } from '../AlgorithmPanel'
import { ZenLockoutPanel } from '../ZenLockoutPanel'
import { NotesSettingsPanel } from '../NotesSettingsPanel'
import { BackupVaultPanel } from '../BackupVaultPanel'
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
    expect(screen.getByText('Algorithm Settings')).toBeInTheDocument()
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
        showHighGoalNudge
        startHereDismissed={false}
        onDismissGoalNudge={() => {}}
        onDismissStartHere={() => {}}
      />,
    )
    expect(screen.getByText('Start here')).toBeInTheDocument()
    expect(screen.getByText('Daily goal tip')).toBeInTheDocument()
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
})
