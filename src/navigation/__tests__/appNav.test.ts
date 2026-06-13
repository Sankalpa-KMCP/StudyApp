import { describe, it, expect } from 'vitest'
import { getNavTabs, ACTIVE_TAB_IDS, getTabChrome, KEYBOARD_TAB_ORDER } from '../appNav'

describe('appNav', () => {
  it('defines nav tabs for every active tab id', () => {
    expect(ACTIVE_TAB_IDS).toEqual(['focus', 'analytics', 'journal', 'settings'])
    expect(getNavTabs().map(tab => tab.id)).toEqual(ACTIVE_TAB_IDS)
  })

  it('provides chrome copy for each tab', () => {
    const chrome = getTabChrome()
    for (const id of ACTIVE_TAB_IDS) {
      expect(chrome[id].title).toBeTruthy()
      expect(chrome[id].subtitle).toBeTruthy()
    }
  })

  it('keyboard tab order matches nav tabs', () => {
    expect(KEYBOARD_TAB_ORDER).toEqual(ACTIVE_TAB_IDS)
    expect(KEYBOARD_TAB_ORDER.length).toBe(4)
  })
})
