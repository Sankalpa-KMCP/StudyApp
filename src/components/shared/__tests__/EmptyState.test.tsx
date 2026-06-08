import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No data yet"
        description="Complete a session to see trends."
      />,
    )
    expect(screen.getByText('No data yet')).toBeInTheDocument()
    expect(screen.getByText('Complete a session to see trends.')).toBeInTheDocument()
  })

  it('renders optional icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">*</span>}
        title="Empty deck"
      />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
