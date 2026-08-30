import { describe, expect, it } from 'vitest'
import {
  isMobileMoreView,
  MOBILE_MORE_VIEWS,
  MOBILE_PRIMARY_VIEWS,
} from './navDestinations'

describe('navDestinations', () => {
  it('defines four primary and four More destinations without overlap', () => {
    expect(MOBILE_PRIMARY_VIEWS).toEqual(['Home', 'Tasks', 'Notes', 'Progress'])
    expect(MOBILE_MORE_VIEWS).toEqual(['Subjects', 'Calendar', 'Goals', 'Settings'])
    expect(new Set([...MOBILE_PRIMARY_VIEWS, ...MOBILE_MORE_VIEWS]).size).toBe(8)
  })

  it('detects More destinations', () => {
    expect(isMobileMoreView('Settings')).toBe(true)
    expect(isMobileMoreView('Home')).toBe(false)
  })
})
