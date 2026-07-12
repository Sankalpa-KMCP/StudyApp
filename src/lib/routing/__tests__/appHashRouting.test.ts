import { describe, it, expect } from 'vitest'
import { parseAppHash, resolveAppHash } from '../appHashRouting'

describe('appHashRouting', () => {
  it('redirects legacy #cards hash to focus', () => {
    expect(parseAppHash('#cards')).toEqual({ tab: 'focus' })
    expect(parseAppHash('cards')).toEqual({ tab: 'focus' })
  })

  it('resolveAppHash maps cards tab id to focus', () => {
    expect(resolveAppHash('cards' as never)).toBe('focus')
  })

  it('parses standard tab hashes', () => {
    expect(parseAppHash('#analytics')).toEqual({ tab: 'analytics' })
    expect(parseAppHash('#settings/data')).toEqual({ tab: 'settings', settingsSection: 'data' })
  })

  it('falls back unknown tabs to focus', () => {
    expect(parseAppHash('#unknown')).toEqual({ tab: 'focus' })
    expect(resolveAppHash('unknown' as never)).toBe('focus')
  })
})
