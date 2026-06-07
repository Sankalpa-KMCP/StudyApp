import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders alertdialog with title and message when open', () => {
    render(
      <ConfirmDialog
        open
        title="Delete workspace?"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete workspace?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm and onCancel from action buttons', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Import backup?"
        message="Replace all data?"
        confirmLabel="Import"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Confirm"
        message="Proceed?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('focuses the cancel button first', () => {
    render(
      <ConfirmDialog
        open
        title="Confirm"
        message="Proceed?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
})
