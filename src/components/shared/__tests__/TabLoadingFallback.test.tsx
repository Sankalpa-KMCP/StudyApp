import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabLoadingFallback } from '../TabLoadingFallback'

describe('TabLoadingFallback', () => {
  it('renders loading label and panel skeletons', () => {
    const { container } = render(<TabLoadingFallback label="journal" />)
    expect(screen.getByText('Loading journal…')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders analytics variant with metrics row skeleton', () => {
    const { container } = render(<TabLoadingFallback label="analytics" variant="analytics" />)
    expect(screen.getByText('Loading analytics…')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-pulse').length).toBeGreaterThan(4)
  })
})
