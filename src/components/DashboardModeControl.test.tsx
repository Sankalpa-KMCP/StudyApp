import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DashboardModeControl } from './DashboardModeControl'

describe('DashboardModeControl', () => {
  it('renders Comfortable and Compact buttons with appropriate aria-pressed states', async () => {
    const user = userEvent.setup()
    const onDensityChange = vi.fn()
    const onEnterZen = vi.fn()

    const { rerender } = render(
      <DashboardModeControl
        density="comfortable"
        onDensityChange={onDensityChange}
        canEnterZen={false}
        onEnterZen={onEnterZen}
      />,
    )

    expect(screen.getByRole('group', { name: 'Dashboard mode' })).toBeInTheDocument()
    const comfortableBtn = screen.getByRole('button', { name: 'Comfortable' })
    const compactBtn = screen.getByRole('button', { name: 'Compact' })
    const zenBtn = screen.getByRole('button', { name: /Zen/ })

    expect(comfortableBtn).toHaveAttribute('aria-pressed', 'true')
    expect(compactBtn).toHaveAttribute('aria-pressed', 'false')
    expect(zenBtn).toBeDisabled()

    await user.click(compactBtn)
    expect(onDensityChange).toHaveBeenCalledWith('compact')

    rerender(
      <DashboardModeControl
        density="compact"
        onDensityChange={onDensityChange}
        canEnterZen={true}
        onEnterZen={onEnterZen}
      />,
    )

    expect(comfortableBtn).toHaveAttribute('aria-pressed', 'false')
    expect(compactBtn).toHaveAttribute('aria-pressed', 'true')
    expect(zenBtn).not.toBeDisabled()

    await user.click(zenBtn)
    expect(onEnterZen).toHaveBeenCalledTimes(1)
    // Verify Zen does not invoke onDensityChange
    expect(onDensityChange).not.toHaveBeenCalledWith('zen')
  })

  it('provides descriptive title and sr-only hint when Zen is disabled', () => {
    const { rerender } = render(
      <DashboardModeControl
        density="comfortable"
        onDensityChange={() => undefined}
        canEnterZen={false}
        canEnterZenReason="no-session"
        onEnterZen={() => undefined}
      />,
    )

    let zenBtn = screen.getByRole('button', { name: /Zen/ })
    expect(zenBtn).toBeDisabled()
    expect(zenBtn).toHaveAttribute('title', 'Zen mode requires an active focus session')

    rerender(
      <DashboardModeControl
        density="comfortable"
        onDensityChange={() => undefined}
        canEnterZen={false}
        canEnterZenReason="stale"
        onEnterZen={() => undefined}
      />,
    )
    zenBtn = screen.getByRole('button', { name: /Zen/ })
    expect(zenBtn).toHaveAttribute('title', 'Resolve unfinished session to use Zen mode')
  })
})
