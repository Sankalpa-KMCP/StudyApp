import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreakBreathingPacer } from '../BreakBreathingPacer'

describe('BreakBreathingPacer', () => {
  it('renders the respiration pacer with the initial inhale phase', () => {
    render(<BreakBreathingPacer />)

    expect(screen.getByText('Respiration Pacer')).toBeInTheDocument()
    expect(screen.getByText('Inhale')).toBeInTheDocument()
    expect(
      screen.getByText('Slow breathing helps reset focus between blocks.'),
    ).toBeInTheDocument()
  })
})
