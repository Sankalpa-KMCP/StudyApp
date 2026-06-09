import { describe, it, expect } from 'vitest'
import { NAV_TABS, ACTIVE_TAB_IDS, TAB_CHROME } from '../appNav'

describe('appNav', () => {
  it('defines nav tabs for every active tab id', () => {
    expect(ACTIVE_TAB_IDS).toEqual(['focus', 'cards', 'analytics', 'journal', 'settings'])
    expect(NAV_TABS.map(tab => tab.id)).toEqual(ACTIVE_TAB_IDS)
  })

  it('provides chrome copy for each tab', () => {
    for (const id of ACTIVE_TAB_IDS) {
      expect(TAB_CHROME[id].title).toBeTruthy()
      expect(TAB_CHROME[id].subtitle).toBeTruthy()
    }
  })
})
