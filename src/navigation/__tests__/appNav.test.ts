import { describe, it, expect } from 'vitest'
import { NAV_TABS, ACTIVE_TAB_IDS, TAB_CHROME, getVisibleNavTabs, getKeyboardTabOrder } from '../appNav'

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

  describe('getVisibleNavTabs', () => {
    it('includes cards when flashcards are enabled', () => {
      const tabs = getVisibleNavTabs(true)
      expect(tabs.map(t => t.id)).toContain('cards')
      expect(tabs.length).toBe(5)
    })

    it('excludes cards when flashcards are disabled', () => {
      const tabs = getVisibleNavTabs(false)
      expect(tabs.map(t => t.id)).not.toContain('cards')
      expect(tabs.length).toBe(4)
    })
  })

  describe('getKeyboardTabOrder', () => {
    it('returns 5 tab ids when enabled', () => {
      expect(getKeyboardTabOrder(true)).toEqual(['focus', 'cards', 'analytics', 'journal', 'settings'])
    })

    it('returns 4 tab ids when disabled', () => {
      expect(getKeyboardTabOrder(false)).toEqual(['focus', 'analytics', 'journal', 'settings'])
    })
  })
})
