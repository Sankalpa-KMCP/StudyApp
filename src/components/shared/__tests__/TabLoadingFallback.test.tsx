import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabLoadingFallback } from '../TabLoadingFallback'

describe('TabLoadingFallback', () => {
  it('renders loading label and panel skeletons', () => {
    const { container } = render(<TabLoadingFallback label="analytics" />)
    expect(screen.getByText('Loading analytics…')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})
