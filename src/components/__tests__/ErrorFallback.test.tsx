import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmProvider } from '../../context/ConfirmProvider'
import { ErrorFallback } from '../ErrorFallback'
import * as backupExport from '../../lib/backup/backupExport'
import * as copyDebug from '../../lib/shared/copyDebugInfo'

vi.mock('../../lib/backup/backupExport', () => ({
  exportStudyBackupFile: vi.fn().mockResolvedValue({ version: 2 }),
}))

vi.mock('../../lib/shared/copyDebugInfo', () => ({
  copyDebugInfo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/db', () => ({
  db: {
    verno: 7,
    delete: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderFallback(props: Partial<React.ComponentProps<typeof ErrorFallback>> = {}) {
  const onRetry = vi.fn()
  const onReload = vi.fn()
  render(
    <ConfirmProvider>
      <ErrorFallback
        message="Test failure"
        stack="Error: Test failure\n  at Component"
        onRetry={onRetry}
        onReload={onReload}
        {...props}
      />
    </ConfirmProvider>,
  )
  return { onRetry, onReload }
}

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders message and all action buttons', () => {
    renderFallback()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test failure')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy debug info' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset database' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument()
  })

  it('calls onRetry and onReload handlers', async () => {
    const user = userEvent.setup()
    const { onRetry, onReload } = renderFallback()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await user.click(screen.getByRole('button', { name: 'Reload app' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('exports data via shared backup helper', async () => {
    const user = userEvent.setup()
    renderFallback()

    await user.click(screen.getByRole('button', { name: 'Export data' }))

    expect(backupExport.exportStudyBackupFile).toHaveBeenCalledWith('study-emergency-export')
  })

  it('copies debug info via shared helper', async () => {
    const user = userEvent.setup()
    renderFallback()

    await user.click(screen.getByRole('button', { name: 'Copy debug info' }))

    expect(copyDebug.copyDebugInfo).toHaveBeenCalledWith(
      expect.stringContaining('message: Test failure'),
    )
  })

  it('opens confirm dialog before reset and keeps fallback on cancel', async () => {
    const user = userEvent.setup()
    renderFallback()

    await user.click(screen.getByRole('button', { name: 'Reset database' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Reset database?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
