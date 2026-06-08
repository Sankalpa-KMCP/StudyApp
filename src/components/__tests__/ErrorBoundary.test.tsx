import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ConfirmProvider } from '../../context/ConfirmProvider'
import { ErrorBoundary } from '../ErrorBoundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Probe failure')
  return <span>Child ok</span>
}

function Harness() {
  const [shouldThrow, setShouldThrow] = useState(true)
  return (
    <ConfirmProvider>
      <div>
        <button type="button" onClick={() => setShouldThrow(false)}>fix child</button>
        <ErrorBoundary>
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>
    </ConfirmProvider>
  )
}

function renderWithConfirm(ui: React.ReactNode) {
  return render(<ConfirmProvider>{ui}</ConfirmProvider>)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders fallback UI when a child throws', () => {
    renderWithConfirm(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Probe failure')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy debug info' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument()
  })

  it('retries rendering children after Try again', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'fix child' }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Child ok')).toBeInTheDocument()
  })

  it('opens confirm dialog before reset', async () => {
    const user = userEvent.setup()
    renderWithConfirm(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Reset database' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Reset database?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders export data action in fallback', () => {
    renderWithConfirm(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset database' })).toBeInTheDocument()
  })
})
