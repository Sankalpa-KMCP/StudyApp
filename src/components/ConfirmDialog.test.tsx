import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function ConfirmHarness({
  pending = false,
  onConfirm = () => undefined,
}: {
  pending?: boolean
  onConfirm?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open confirm
      </button>
      <ConfirmDialog
        open={open}
        title="Confirm deletion"
        description="Delete Practice set? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onConfirm()
          if (!pending) setOpen(false)
        }}
      />
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Confirm deletion"
        description="Hidden"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes title and description with dialog semantics', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))

    const dialog = screen.getByRole('dialog', { name: 'Confirm deletion' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Delete Practice set? This cannot be undone.')
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveClass('is-destructive')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('moves initial focus to Cancel', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    })
  })

  it('contains Tab and Shift+Tab within the dialog', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))

    const dialog = screen.getByRole('dialog')
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    await waitFor(() => expect(cancel).toHaveFocus())

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('cancels on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    const trigger = screen.getByRole('button', { name: 'Open confirm' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('cancels from the Cancel button and returns focus', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    const trigger = screen.getByRole('button', { name: 'Open confirm' })
    await user.click(trigger)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('cancels from backdrop click without confirming', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmHarness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))

    fireEvent.mouseDown(document.querySelector('.confirm-dialog-backdrop')!)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invokes confirm once and ignores a second activation while pending', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    function PendingHarness() {
      const [open, setOpen] = useState(false)
      const [pending, setPending] = useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>Open confirm</button>
          <ConfirmDialog
            open={open}
            title="Confirm deletion"
            description="Delete Practice set? This cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            destructive
            pending={pending}
            onCancel={() => {
              if (!pending) setOpen(false)
            }}
            onConfirm={() => {
              onConfirm()
              setPending(true)
            }}
          />
        </div>
      )
    }

    render(<PendingHarness />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' })
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)

    const pendingConfirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete...' })
    expect(pendingConfirm).toBeDisabled()
    await user.click(pendingConfirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('uses a mobile-friendly action target size class structure', async () => {
    const user = userEvent.setup()
    render(<ConfirmHarness />)
    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('confirm-dialog')
    expect(dialog.parentElement).toHaveClass('confirm-dialog-backdrop')
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveClass('primary-command')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveClass('secondary-command')
  })
})
