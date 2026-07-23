import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Check, Plus, Search, X } from './icons'
import { EmptyState, PanelHeader } from './ui'

describe('local icons', () => {
  it('applies Lucide default SVG attributes and size overrides', () => {
    const { container } = render(<Check size={16} data-testid="check-icon" />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-linecap', 'round')
    expect(svg).toHaveAttribute('stroke-linejoin', 'round')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg?.querySelectorAll('path')).toHaveLength(1)
  })

  it('forwards aria attributes, className, strokeWidth, and refs', () => {
    const ref = createRef<SVGSVGElement>()
    render(
      <Search
        ref={ref}
        size={20}
        strokeWidth={1.8}
        className="nav-search-icon"
        aria-hidden="true"
        data-testid="search-icon"
      />,
    )

    const svg = screen.getByTestId('search-icon')
    expect(ref.current).toBe(svg)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke-width', '1.8')
    expect(svg).toHaveClass('lucide', 'nav-search-icon')
  })

  it('defaults aria-hidden when no accessibility props are provided', () => {
    const { container } = render(<Plus size={18} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('supports component-as-prop empty states and dynamic panel icons', () => {
    render(
      <>
        <EmptyState
          icon={Check}
          title="No items found"
          body="Please create an item"
          actionLabel="Create Item"
          onAction={() => undefined}
        />
        <PanelHeader title="Workspace" description="Organize work." actionLabel="Add New" onAction={() => undefined} />
        <PanelHeader title="Clear Area" description="Reset values." actionLabel="Clear all" onAction={() => undefined} />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add New' }).querySelector('svg')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear all' }).querySelector('svg')).toBeTruthy()
    expect(document.querySelector('.empty-icon svg')).toBeTruthy()
  })

  it('keeps X and Plus available as distinct icon components', () => {
    const { container } = render(
      <>
        <X size={14} data-testid="x-icon" />
        <Plus size={14} data-testid="plus-icon" />
      </>,
    )

    expect(screen.getByTestId('x-icon').querySelectorAll('path').length).toBeGreaterThan(0)
    expect(screen.getByTestId('plus-icon').querySelectorAll('path').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('svg')).toHaveLength(2)
  })
})
