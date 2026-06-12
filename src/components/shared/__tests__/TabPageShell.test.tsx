import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabPageShell, TabSection, TabSectionLabel } from '../TabPageShell'

describe('TabPageShell', () => {
  it('renders grid12 layout classes', () => {
    const { container } = render(
      <TabPageShell>
        <div className="lg:col-span-6">Column</div>
      </TabPageShell>,
    )
    const shell = container.firstChild as HTMLElement
    expect(shell.className).toContain('tab-page-shell')
    expect(shell.className).toContain('lg:grid-cols-12')
    expect(screen.getByText('Column')).toBeInTheDocument()
  })
})

describe('TabSection', () => {
  it('renders section label and children in col-span-12 wrapper', () => {
    const { container } = render(
      <TabPageShell>
        <TabSection label="Overview">
          <div>Metrics</div>
        </TabSection>
      </TabPageShell>,
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Metrics')).toBeInTheDocument()
    const section = container.querySelector('.lg\\:col-span-12')
    expect(section).toBeInTheDocument()
  })
})

describe('TabSectionLabel', () => {
  it('renders section label with panel-title token', () => {
    render(<TabSectionLabel>Overview</TabSectionLabel>)
    const label = screen.getByText('Overview')
    expect(label.className).toContain('panel-title')
    expect(label.className).not.toContain('uppercase')
  })
})
