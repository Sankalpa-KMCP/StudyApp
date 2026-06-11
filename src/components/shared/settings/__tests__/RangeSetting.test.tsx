import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RangeSetting } from '../RangeSetting'

describe('RangeSetting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces onChange', () => {
    const onChange = vi.fn()
    render(
      <RangeSetting label="Test" value={10} min={0} max={100} onChange={onChange} debounceMs={300} />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '20' } })

    expect(onChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onChange).toHaveBeenCalledWith(20)
  })

  it('commits immediately on pointer up', () => {
    const onChange = vi.fn()
    render(
      <RangeSetting label="Test" value={10} min={0} max={100} onChange={onChange} debounceMs={300} />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '30' } })
    fireEvent.pointerUp(slider)

    expect(onChange).toHaveBeenCalledWith(30)
  })
})
