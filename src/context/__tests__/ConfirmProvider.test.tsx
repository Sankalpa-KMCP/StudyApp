import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmProvider } from '../ConfirmProvider'
import { useConfirm } from '../useConfirm'

function ConfirmProbeWithResult() {
  const { requestConfirm } = useConfirm()
  return (
    <div>
      <span data-testid="result">pending</span>
      <button
        type="button"
        onClick={async () => {
          const ok = await requestConfirm({
            title: 'Import backup?',
            message: 'Replace all local data?',
            confirmLabel: 'Import',
          })
          const el = document.querySelector('[data-testid="result"]')
          if (el) el.textContent = String(ok)
        }}
      >
        Open confirm
      </button>
    </div>
  )
}

describe('ConfirmProvider', () => {
  it('resolves true when confirm is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <ConfirmProbeWithResult />
      </ConfirmProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Import backup?')).toBeInTheDocument()
    expect(screen.getByText('Replace all local data?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('true')
    })
  })

  it('resolves false when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <ConfirmProbeWithResult />
      </ConfirmProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('false')
    })
  })

  it('resolves false on Escape', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmProvider>
        <ConfirmProbeWithResult />
      </ConfirmProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('false')
    })
  })
})
