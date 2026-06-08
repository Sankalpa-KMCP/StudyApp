import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RangeSetting } from '../RangeSetting'

describe('RangeSetting', () => {
  it('renders label and value badge', () => {
    render(<RangeSetting label="Opacity" value={70} min={0} max={100} onChange={vi.fn()} unit="%" />)
    expect(screen.getByText('Opacity')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('calls onChange when slider value changes', () => {
    const onChange = vi.fn()
    render(<RangeSetting label="Blur" value={8} min={4} max={24} onChange={onChange} unit="px" />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '12' } })
    expect(onChange).toHaveBeenCalled()
  })
})
