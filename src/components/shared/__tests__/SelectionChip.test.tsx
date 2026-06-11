import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SelectionChip } from '../SelectionChip'

describe('SelectionChip', () => {
  it('marks selected state with aria-pressed', () => {
    render(
      <SelectionChip selected accent="blue">
        25m
      </SelectionChip>,
    )
    expect(screen.getByRole('button', { name: '25m' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks unselected state', () => {
    render(
      <SelectionChip selected={false} accent="amber">
        Break
      </SelectionChip>,
    )
    expect(screen.getByRole('button', { name: 'Break' })).toHaveAttribute('aria-pressed', 'false')
  })
})
