import { describe, it, expect } from 'vitest'
import { buildCommandPaletteItems, filterCommandPaletteItems } from '../../lib/routing/commandPaletteSearch'

describe('commandPaletteSearch', () => {
  it('builds items excluding flashcards when disabled', () => {
    const items = buildCommandPaletteItems({
      tasks: [{ id: 1, text: 'Read chapter', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 }],
      notes: [{ id: 2, title: 'Ideas', content: 'memo', updatedAt: 0 }],
      flashcards: [{ id: 3, question: 'Q', answer: 'A', createdAt: 0, repetitionCount: 0, easinessFactor: 2.5, intervalDays: 0 }],
      categories: [],
      flashcardsEnabled: false,
    })
    expect(items.some(i => i.type === 'flashcard')).toBe(false)
    expect(items.some(i => i.type === 'tab' && i.tab === 'cards')).toBe(false)
    expect(items.some(i => i.type === 'task')).toBe(true)
    expect(items.some(i => i.type === 'settings' && i.settingsSection === 'settings-timer-focus')).toBe(true)
    expect(items.some(i => i.type === 'action' && i.actionId === 'toggle-timer')).toBe(true)
  })

  it('filters by query', () => {
    const items = buildCommandPaletteItems({
      tasks: [
        { id: 1, text: 'Math homework', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 },
        { id: 2, text: 'History essay', completed: false, createdAt: 0, estimatedCycles: 1, actualCycles: 0 },
      ],
      notes: [],
      flashcards: [],
      categories: [],
      flashcardsEnabled: true,
    })
    const filtered = filterCommandPaletteItems(items, 'math')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].label).toBe('Math homework')
  })
})
