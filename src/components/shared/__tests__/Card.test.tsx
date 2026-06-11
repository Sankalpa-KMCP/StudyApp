import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Panel content</Card>)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('applies variant and padding classes', () => {
    const { container } = render(
      <Card variant="elevated" padding="lg" data-testid="card">
        Content
      </Card>,
    )
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('dynamic-card-static')
    expect(card.className).toContain('shadow-2xl')
    expect(card.className).toContain('p-6')
  })

  it('uses inset variant', () => {
    const { container } = render(<Card variant="inset">Inset</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('glass-tier-2')
  })
})
