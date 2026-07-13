import { describe, it, expect } from 'vitest'
import { buildCommandPaletteItems, filterCommandPaletteItems, getCommandPaletteGroupLabels } from '../../lib/routing/commandPaletteSearch'

describe('commandPaletteSearch', () => {
  it('builds items without flashcard entries', () => {
    const items = buildCommandPaletteItems({
      tasks: [{ id: 1, text: 'Read chapter', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 }],
      notes: [{ id: 2, title: 'Ideas', content: 'memo', updatedAt: 0 }],
      categories: [],
    })
    expect(items.some(i => i.type === 'task')).toBe(true)
    expect(items.some(i => i.type === 'settings' && i.settingsSection === 'settings-timer-focus')).toBe(true)
    expect(items.some(i => i.type === 'action' && i.actionId === 'toggle-timer')).toBe(true)
    expect(items.some(i => i.label.toLowerCase().includes('flashcard'))).toBe(false)
  })

  it('filters by query', () => {
    const items = buildCommandPaletteItems({
      tasks: [
        { id: 1, text: 'Math homework', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 },
        { id: 2, text: 'History essay', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 },
      ],
      notes: [],
      categories: [],
    })
    const filtered = filterCommandPaletteItems(items, 'math')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].label).toBe('Math homework')
  })

  it('provides localized group labels', () => {
    const labels = getCommandPaletteGroupLabels()
    expect(labels.action).toBe('Actions')
    expect(labels.tab).toBe('Go to')
    expect(labels.journal).toBe('Journal')
  })
})
