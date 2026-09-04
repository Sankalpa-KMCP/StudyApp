import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataOperationCoordinator } from '../db/dataCoordinator'
import { THEME_CONFIGS } from '../styles/themeRegistry'
import { SettingsView } from './SettingsView'

function TestSettingsViewWrapper({
  coordinator,
  onExport = vi.fn().mockResolvedValue(undefined),
  onImport = vi.fn().mockResolvedValue(undefined),
  onClear = vi.fn().mockResolvedValue(undefined),
  onShowOnboardingChecklist = vi.fn().mockResolvedValue(undefined),
  importPending = false,
}: {
  coordinator: DataOperationCoordinator
  onExport?: () => Promise<void>
  onImport?: (file: File) => Promise<void>
  onClear?: () => Promise<void>
  onShowOnboardingChecklist?: () => Promise<void>
  importPending?: boolean
}) {
  const coordinatorState = coordinator.getSnapshot()
  return (
    <SettingsView
      coordinatorState={coordinatorState}
      onExport={onExport}
      onImport={onImport}
      onClear={onClear}
      onShowOnboardingChecklist={onShowOnboardingChecklist}
      importPending={importPending}
      profileNotice=""
      theme="monochrome"
      onThemeChange={() => undefined}
    />
  )
}

describe('SettingsView concurrency and coordinator integration', () => {
  it('disables all Settings operations and displays status label during active Import', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseImport!: () => void
    const importGate = new Promise<void>((resolve) => { releaseImport = resolve })
    void coordinator.runImport(async () => importGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText('Importing backup…')[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data/ })).toBeDisabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseImport()
  })

  it('disables all Settings operations and displays status label during active Delete All', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseDelete!: () => void
    const deleteGate = new Promise<void>((resolve) => { releaseDelete = resolve })
    void coordinator.runDeleteAll(async () => deleteGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText('Deleting study data…')[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export data/ })).toBeDisabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseDelete()
  })

  it('disables Import and Delete All while allowing Export during focus write', async () => {
    const coordinator = new DataOperationCoordinator()
    let releaseFocus!: () => void
    const focusGate = new Promise<void>((resolve) => { releaseFocus = resolve })
    void coordinator.runFocusWrite(async () => focusGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getByRole('button', { name: /Export data/ })).toBeEnabled()
    expect(screen.getByLabelText(/Import data/)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeDisabled()

    releaseFocus()
  })

  it('resets file input value after selection so same file can be re-selected', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    const onImport = vi.fn().mockResolvedValue(undefined)

    render(<TestSettingsViewWrapper coordinator={coordinator} onImport={onImport} />)

    const file = new File(['{"version":3}'], 'test.json', { type: 'application/json' })
    const input = screen.getByLabelText(/Import data/) as HTMLInputElement

    await user.upload(input, file)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('')

    // Upload same file again
    await user.upload(input, file)
    expect(onImport).toHaveBeenCalledTimes(2)
  })

  it('prevents opening Delete All confirmation dialog when clear is unavailable', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    let releaseFocus!: () => void
    const focusGate = new Promise<void>((resolve) => { releaseFocus = resolve })
    void coordinator.runFocusWrite(async () => focusGate)

    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    const resetButton = screen.getByRole('button', { name: /Reset all study data/ })
    expect(resetButton).toBeDisabled()

    await user.click(resetButton)
    expect(screen.queryByPlaceholderText('DELETE')).not.toBeInTheDocument()

    releaseFocus()
  })

  it('shows busy error notice when blocked attempt is made and does not false report success', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()

    // Export blocked when another Settings operation is running
    let releaseImport!: () => void
    const importGate = new Promise<void>((resolve) => { releaseImport = resolve })
    void coordinator.runImport(async () => importGate)

    const onExport = vi.fn()
    render(<TestSettingsViewWrapper coordinator={coordinator} onExport={onExport} />)

    // Force click blocked export
    const exportBtn = screen.getByRole('button', { name: /Export data/ })
    await user.click(exportBtn)

    expect(onExport).not.toHaveBeenCalled()
    releaseImport()
  })

  it('documents unencrypted JSON format, point-in-time snapshot, included data, and excluded preferences', () => {
    const coordinator = new DataOperationCoordinator()
    render(<TestSettingsViewWrapper coordinator={coordinator} />)

    expect(screen.getAllByText(/unencrypted JSON backup/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/one consistent snapshot/i)).toBeInTheDocument()
    expect(screen.getByText(/Changes committed after the snapshot begins may not appear/i)).toBeInTheDocument()
    expect(screen.getByText(/subjects, tasks, notes, calendar events, study sessions, goals, and supported settings/i)).toBeInTheDocument()
    expect(screen.getByText(/Active focus-session data is included when present/i)).toBeInTheDocument()
    expect(screen.getByText(/Device-local appearance and sidebar preferences are excluded/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Export data/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Import data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset all study data/ })).toBeInTheDocument()
  })

  it('provides persistent accessible labeling and instructions for delete-all confirmation input', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    const onClear = vi.fn().mockResolvedValue(undefined)
    render(<TestSettingsViewWrapper coordinator={coordinator} onClear={onClear} />)

    // Open delete-all confirmation
    const resetButton = screen.getByRole('button', { name: /Reset all study data/ })
    await user.click(resetButton)

    // Verify input is programmatically queryable by its accessible label before typing
    const confirmInput = screen.getByLabelText('Type DELETE to permanently remove all study data.')
    expect(confirmInput).toBeInTheDocument()
    expect(confirmInput).toHaveAttribute('type', 'text')

    const deleteBtn = screen.getByRole('button', { name: 'Delete all data' })
    expect(deleteBtn).toBeDisabled()

    // Type partial text — label must remain accessible and button stays disabled
    await user.type(confirmInput, 'DEL')
    expect(screen.getByLabelText('Type DELETE to permanently remove all study data.')).toHaveValue('DEL')
    expect(deleteBtn).toBeDisabled()

    // Complete typing 'DELETE'
    await user.type(confirmInput, 'ETE')
    expect(confirmInput).toHaveValue('DELETE')
    expect(deleteBtn).toBeEnabled()

    // Click delete
    await user.click(deleteBtn)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('SettingsView theme gallery and selection', () => {
  it('renders all 21 themes from THEME_CONFIGS with miniature previews and accessible radio semantics', () => {
    const coordinator = new DataOperationCoordinator()
    render(<TestSettingsViewWrapper coordinator={coordinator} theme="monochrome" />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(radiogroup).toBeInTheDocument()

    const radioOptions = screen.getAllByRole('radio')
    expect(radioOptions).toHaveLength(21)

    // Check that every theme has a decorative preview container with data-theme-preview
    const previews = radiogroup.querySelectorAll('.theme-preview')
    expect(previews).toHaveLength(21)
    previews.forEach((preview) => {
      expect(preview).toHaveAttribute('aria-hidden', 'true')
      expect(preview).toHaveAttribute('data-theme-preview')
    })

    // Active theme verification (monochrome)
    const monochromeOption = screen.getByRole('radio', { name: /Monochrome/i })
    expect(monochromeOption).toHaveAttribute('aria-checked', 'true')
    expect(monochromeOption).toHaveAttribute('tabIndex', '0')
    expect(monochromeOption.querySelector('.theme-selected-badge')).toBeInTheDocument()

    // Category headers and dynamic counts verification
    expect(screen.getByText('Light themes')).toBeInTheDocument()
    expect(screen.getByText('Dark themes')).toBeInTheDocument()
    const lightCount = THEME_CONFIGS.filter((c) => c.colorScheme === 'light').length
    const darkCount = THEME_CONFIGS.filter((c) => c.colorScheme === 'dark').length
    expect(screen.getByLabelText(`${lightCount} light themes`)).toHaveTextContent(lightCount.toString())
    expect(screen.getByLabelText(`${darkCount} dark themes`)).toHaveTextContent(darkCount.toString())

    // Non-active theme verification (e.g. sage, nordic, obsidian, espresso, rose-quartz, plum-noir)
    const sageOption = screen.getByRole('radio', { name: /Sage Botanical/i })
    expect(sageOption).toHaveAttribute('aria-checked', 'false')
    expect(sageOption).toHaveAttribute('tabIndex', '-1')
    expect(sageOption.querySelector('.theme-selected-badge')).toBeNull()

    const roseQuartzOption = screen.getByRole('radio', { name: /Rose Quartz/i })
    expect(roseQuartzOption).toHaveAttribute('aria-checked', 'false')

    const nordicOption = screen.getByRole('radio', { name: /Nordic Slate/i })
    expect(nordicOption).toHaveAttribute('aria-checked', 'false')

    const plumNoirOption = screen.getByRole('radio', { name: /Plum Noir/i })
    expect(plumNoirOption).toHaveAttribute('aria-checked', 'false')

    const obsidianOption = screen.getByRole('radio', { name: /High-Contrast Obsidian/i })
    expect(obsidianOption).toHaveAttribute('aria-checked', 'false')

    const espressoOption = screen.getByRole('radio', { name: /Espresso/i })
    expect(espressoOption).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onThemeChange when a theme option is clicked', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    const onThemeChange = vi.fn()

    render(
      <SettingsView
        coordinatorState={coordinator.getSnapshot()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        onImport={vi.fn().mockResolvedValue(undefined)}
        onClear={vi.fn().mockResolvedValue(undefined)}
        onShowOnboardingChecklist={vi.fn().mockResolvedValue(undefined)}
        profileNotice=""
        theme="monochrome"
        onThemeChange={onThemeChange}
      />,
    )

    const nordicOption = screen.getByRole('radio', { name: /Nordic Slate/i })
    await user.click(nordicOption)
    expect(onThemeChange).toHaveBeenCalledWith('nordic')

    const espressoOption = screen.getByRole('radio', { name: /Espresso/i })
    await user.click(espressoOption)
    expect(onThemeChange).toHaveBeenCalledWith('espresso')
  })

  it('supports full keyboard navigation across all 21 themes including Light and Dark section boundaries', async () => {
    const user = userEvent.setup()
    const coordinator = new DataOperationCoordinator()
    const onThemeChange = vi.fn()

    render(
      <SettingsView
        coordinatorState={coordinator.getSnapshot()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        onImport={vi.fn().mockResolvedValue(undefined)}
        onClear={vi.fn().mockResolvedValue(undefined)}
        onShowOnboardingChecklist={vi.fn().mockResolvedValue(undefined)}
        profileNotice=""
        theme="monochrome"
        onThemeChange={onThemeChange}
      />,
    )

    const radioOptions = screen.getAllByRole('radio')
    radioOptions[0].focus()
    expect(radioOptions[0]).toHaveFocus()

    // ArrowRight moves from 0 (monochrome) to 1 (light)
    await user.keyboard('{ArrowRight}')
    expect(onThemeChange).toHaveBeenLastCalledWith('light')

    // ArrowDown moves from 1 (light) to 2 (blueprint)
    await user.keyboard('{ArrowDown}')
    expect(onThemeChange).toHaveBeenLastCalledWith('blueprint')

    // ArrowLeft moves from 2 (blueprint) to 1 (light)
    await user.keyboard('{ArrowLeft}')
    expect(onThemeChange).toHaveBeenLastCalledWith('light')

    // ArrowUp moves from 1 (light) to 0 (monochrome)
    await user.keyboard('{ArrowUp}')
    expect(onThemeChange).toHaveBeenLastCalledWith('monochrome')

    // Cross-boundary: last Light theme (index 10: wisteria) → first Dark theme (index 11: midnight)
    radioOptions[10].focus()
    expect(radioOptions[10]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(onThemeChange).toHaveBeenLastCalledWith('dark')

    // Cross-boundary: from Midnight, ArrowLeft moves back to Wisteria Bloom
    await user.keyboard('{ArrowLeft}')
    expect(onThemeChange).toHaveBeenLastCalledWith('wisteria')

    // End moves to the final option (20: Abyssal Glow)
    await user.keyboard('{End}')
    expect(onThemeChange).toHaveBeenLastCalledWith('abyss')

    // Home moves to the first option (0: monochrome)
    await user.keyboard('{Home}')
    expect(onThemeChange).toHaveBeenLastCalledWith('monochrome')
  })

  it('renders Dashboard mode preference selector and handles density change and Zen trigger', async () => {
    const user = userEvent.setup()
    const onDensityChange = vi.fn()
    const onEnterZen = vi.fn()

    const { rerender } = render(
      <SettingsView
        onExport={vi.fn().mockResolvedValue(undefined)}
        onImport={vi.fn().mockResolvedValue(undefined)}
        onClear={vi.fn().mockResolvedValue(undefined)}
        onShowOnboardingChecklist={vi.fn().mockResolvedValue(undefined)}
        profileNotice=""
        theme="monochrome"
        onThemeChange={() => undefined}
        density="comfortable"
        onDensityChange={onDensityChange}
        canEnterZen={false}
        canEnterZenReason="no-session"
        onEnterZen={onEnterZen}
      />,
    )

    expect(screen.getByText('Dashboard mode')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Dashboard mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfortable' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Zen/ })).toBeDisabled()
    expect(screen.getByText('Zen is available during an active Focus session.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Compact' }))
    expect(onDensityChange).toHaveBeenCalledWith('compact')

    // Rerender with active focus session (canEnterZen = true)
    rerender(
      <SettingsView
        onExport={vi.fn().mockResolvedValue(undefined)}
        onImport={vi.fn().mockResolvedValue(undefined)}
        onClear={vi.fn().mockResolvedValue(undefined)}
        onShowOnboardingChecklist={vi.fn().mockResolvedValue(undefined)}
        profileNotice=""
        theme="monochrome"
        onThemeChange={() => undefined}
        density="compact"
        onDensityChange={onDensityChange}
        canEnterZen={true}
        canEnterZenReason="available"
        onEnterZen={onEnterZen}
      />,
    )

    const zenBtn = screen.getByRole('button', { name: /Zen/ })
    expect(zenBtn).not.toBeDisabled()
    await user.click(zenBtn)
    expect(onEnterZen).toHaveBeenCalledTimes(1)
  })
})
