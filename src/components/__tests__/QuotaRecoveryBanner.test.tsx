import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuotaRecoveryBanner } from '../QuotaRecoveryBanner'

describe('QuotaRecoveryBanner', () => {
  it('renders warning and action buttons', () => {
    render(
      <QuotaRecoveryBanner
        onExport={vi.fn()}
        onOpenRecovery={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Storage full/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export now' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open recovery' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('fires action callbacks', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    const onOpenRecovery = vi.fn()
    const onDismiss = vi.fn()

    render(
      <QuotaRecoveryBanner
        onExport={onExport}
        onOpenRecovery={onOpenRecovery}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Export now' }))
    await user.click(screen.getByRole('button', { name: 'Open recovery' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onOpenRecovery).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
