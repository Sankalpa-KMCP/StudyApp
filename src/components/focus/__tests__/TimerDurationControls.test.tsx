import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerDurationControls } from '../TimerDurationControls'

describe('TimerDurationControls', () => {
  const baseProps = {
    timerMode: 'study' as const,
    isLongBreak: false,
    studyBlockDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    activeColor: 'var(--color-accent-blue)',
    onDurationChange: vi.fn(),
  }

  it('toggles duration controls visibility via adjust length button', async () => {
    const user = userEvent.setup()
    render(<TimerDurationControls {...baseProps} />)

    expect(screen.getByRole('button', { name: 'Adjust length' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Adjust length' }))
    expect(screen.getByRole('button', { name: 'Hide length controls' })).toBeInTheDocument()
  })

  it('calls onDurationChange when a preset chip is selected', async () => {
    const user = userEvent.setup()
    const onDurationChange = vi.fn()
    render(<TimerDurationControls {...baseProps} onDurationChange={onDurationChange} />)

    await user.click(screen.getByRole('button', { name: 'Adjust length' }))
    await user.click(screen.getByRole('button', { name: '45m' }))

    expect(onDurationChange).toHaveBeenCalledWith(45)
  })
})
