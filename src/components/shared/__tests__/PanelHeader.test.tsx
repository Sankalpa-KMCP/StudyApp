import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelHeader } from '../PanelHeader'

describe('PanelHeader', () => {
  it('renders sentence-case title with panel-title token', () => {
    render(<PanelHeader title="Focus Timer" />)
    const title = screen.getByText('Focus Timer')
    expect(title.className).toContain('panel-title')
    expect(title.className).not.toContain('uppercase')
  })

  it('renders action slot', () => {
    render(<PanelHeader title="Study tasks" action={<button type="button">Add</button>} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})
