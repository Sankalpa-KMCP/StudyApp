import { describe, it, expect } from 'vitest'
import { NAV_TABS, ACTIVE_TAB_IDS, TAB_CHROME, KEYBOARD_TAB_ORDER } from '../appNav'

describe('appNav', () => {
  it('defines nav tabs for every active tab id', () => {
    expect(ACTIVE_TAB_IDS).toEqual(['focus', 'analytics', 'journal', 'settings'])
    expect(NAV_TABS.map(tab => tab.id)).toEqual(ACTIVE_TAB_IDS)
  })

  it('provides chrome copy for each tab', () => {
    for (const id of ACTIVE_TAB_IDS) {
      expect(TAB_CHROME[id].title).toBeTruthy()
      expect(TAB_CHROME[id].subtitle).toBeTruthy()
    }
  })

  it('keyboard tab order matches nav tabs', () => {
    expect(KEYBOARD_TAB_ORDER).toEqual(ACTIVE_TAB_IDS)
    expect(KEYBOARD_TAB_ORDER.length).toBe(4)
  })
})
