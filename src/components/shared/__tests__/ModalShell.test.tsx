import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalShell } from '../ModalShell'

describe('ModalShell', () => {
  it('renders nothing when closed', () => {
    render(
      <ModalShell open={false} ariaLabelledby="title">
        <h2 id="title">Hidden</h2>
      </ModalShell>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with aria-modal when open', () => {
    render(
      <ModalShell open ariaLabelledby="modal-title">
        <h2 id="modal-title">Settings</h2>
      </ModalShell>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ModalShell open onClose={onClose} ariaLabelledby="title">
        <h2 id="title">Modal</h2>
        <button type="button">Inside</button>
      </ModalShell>,
    )
    await user.click(screen.getByRole('button', { name: 'Inside' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
