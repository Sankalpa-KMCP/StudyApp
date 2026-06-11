import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsCard } from '../SettingsCard'

describe('SettingsCard', () => {
  it('renders title and children inside PanelCard', () => {
    render(
      <SettingsCard title="Timer">
        <p>Child content</p>
      </SettingsCard>,
    )
    expect(screen.getByText('Timer')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })
})
