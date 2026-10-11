import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View } from '../navigation/viewRoutes'
import { useSiteEntrance } from './useSiteEntrance'

function Harness({ loading = false, view = 'Home' }: { loading?: boolean; view?: View }) {
  const { playing, preparing, containerRef } = useSiteEntrance(loading, view)
  return <div className="app-shell"><div ref={containerRef} data-testid="entry" data-playing={playing} data-preparing={preparing}>{view}</div></div>
}

describe('ready-document entrance lifecycle', () => {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations')
  let finish: () => void
  let cancel: (error: Error) => void
  let animation: { animationName: string; finished: Promise<void>; currentTime: number; playState: AnimationPlayState; pending: boolean }
  const nextAnimation = () => {
    // jsdom has no Web Animations implementation; only this consumed surface is mocked.
    const finished = new Promise<void>((resolve, reject) => { finish = resolve; cancel = reject })
    animation = { animationName: 'heroContentSettle', finished, currentTime: 0, playState: 'running', pending: false }
    return animation
  }
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: vi.fn(() => [nextAnimation()]) })
  })
  afterEach(() => {
    vi.useRealTimers()
    if (original) Object.defineProperty(Element.prototype, 'getAnimations', original)
    else Reflect.deleteProperty(Element.prototype, 'getAnimations')
  })
  const playing = () => screen.getByTestId('entry').getAttribute('data-playing')

  it('paints the prepared keyframe before starting native playback', () => {
    render(<Harness />)
    expect(screen.getByTestId('entry')).toHaveAttribute('data-preparing', 'true')
    act(() => vi.advanceTimersByTime(40))
    expect(screen.getByTestId('entry')).toHaveAttribute('data-preparing', 'false')
    expect(playing()).toBe('true')
  })

  it('does not cancel a still-progressing native timeline at the wall-clock fallback', async () => {
    render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    animation.currentTime = 400
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('true')
    animation.currentTime = 800
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('true')
    await act(async () => finish())
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('false')
  })

  it('waits for readiness, settles, and does not replay on rerenders or navigation', async () => {
    const { rerender } = render(<Harness loading />)
    expect(playing()).toBe('false')
    expect(Element.prototype.getAnimations).not.toHaveBeenCalled()
    rerender(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('true')
    await act(async () => { finish() })
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('false')
    rerender(<Harness view="Notes" />)
    rerender(<Harness />)
    expect(playing()).toBe('false')
    expect(Element.prototype.getAnimations).toHaveBeenCalledTimes(2)
  })

  it('cancels on navigation and ignores an old completion after restoration', async () => {
    const { rerender } = render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    const oldFinish = finish
    rerender(<Harness view="Notes" />)
    expect(playing()).toBe('false')
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    act(() => vi.advanceTimersByTime(80))
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('true')
    await act(async () => oldFinish())
    expect(playing()).toBe('true')
    await act(async () => finish())
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('false')
  })

  it('settles cancelled animations and bounds paused or unsupported animations', async () => {
    const first = render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    await act(async () => cancel(new Error('animation cancelled')))
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('false')
    first.unmount()
    render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('false')
  })

  it('settles an empty animation list (including reduced motion)', async () => {
    vi.mocked(Element.prototype.getAnimations).mockReturnValue([])
    render(<Harness />)
    await act(async () => {})
    expect(playing()).toBe('false')
  })

  it('recovers when progress stalls and the native completion promise never settles', () => {
    render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    animation.currentTime = 400
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('true')
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('false')
  })

  it('does not mistake a pending native play task for a stalled timeline', async () => {
    render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    animation.pending = true
    act(() => vi.advanceTimersByTime(1600))
    expect(playing()).toBe('true')
    animation.pending = false
    await act(async () => finish())
    act(() => vi.advanceTimersByTime(40))
    expect(playing()).toBe('false')
  })

  it('retains a hard recovery bound even if a broken timeline keeps advancing', () => {
    render(<Harness />)
    act(() => vi.advanceTimersByTime(40))
    for (let tick = 1; tick <= 6; tick++) {
      animation.currentTime = tick * 100
      act(() => vi.advanceTimersByTime(1600))
      expect(playing()).toBe('true')
    }
    animation.currentTime = 700
    act(() => vi.advanceTimersByTime(400))
    expect(playing()).toBe('false')
  })

  it('does not double-play initial pageshow and cancels scheduled restoration on unmount', () => {
    const { unmount } = render(<Harness />)
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })))
    expect(Element.prototype.getAnimations).toHaveBeenCalledTimes(1)
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    unmount()
    act(() => vi.advanceTimersByTime(100))
    expect(Element.prototype.getAnimations).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
