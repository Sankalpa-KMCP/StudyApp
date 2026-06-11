import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelCard } from '../PanelCard'

describe('PanelCard', () => {
  it('renders children with elevated card classes', () => {
    const { container } = render(<PanelCard>Panel content</PanelCard>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('dynamic-card-static')
    expect(card.className).toContain('shadow-2xl')
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })
})
