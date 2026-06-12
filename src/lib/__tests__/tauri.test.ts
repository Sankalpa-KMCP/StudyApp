import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('tauri bridge', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isTauri returns false outside desktop shell', async () => {
    const { isTauri } = await import('../tauri')
    expect(isTauri()).toBe(false)
  })

  it('isTauri returns true when Tauri internals are present', async () => {
    vi.stubGlobal('__TAURI_INTERNALS__', {})
    const { isTauri } = await import('../tauri')
    expect(isTauri()).toBe(true)
  })

  it('initDesktopTrayBridge dispatches timer toggle on desktop event', async () => {
    vi.stubGlobal('__TAURI_INTERNALS__', {})
    const listen = vi.fn().mockResolvedValue(() => {})
    vi.doMock('@tauri-apps/api/event', () => ({ listen }))

    const { initDesktopTrayBridge } = await import('../tauri')
    const handler = vi.fn()
    window.addEventListener('desktop-timer-toggle', handler)

    await initDesktopTrayBridge()
    expect(listen).toHaveBeenCalledWith('desktop-timer-toggle', expect.any(Function))

    const callback = listen.mock.calls[0][1] as () => void
    callback()
    expect(handler).toHaveBeenCalled()
  })
})
