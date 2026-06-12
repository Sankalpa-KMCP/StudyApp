import { describe, it, expect } from 'vitest'
import { parseFlashcardCsv, parseFlashcardTsv, parseFlashcardImport } from '../flashcardImport'

describe('flashcardImport', () => {
  it('parses tab-separated Anki-style text', () => {
    const rows = parseFlashcardTsv('front\tback\tcategory\nHello\tWorld\tMath')
    expect(rows).toEqual([{ front: 'Hello', back: 'World', category: 'Math' }])
  })

  it('skips comment lines in tsv', () => {
    const rows = parseFlashcardTsv('# exported\nTerm\tDefinition')
    expect(rows).toEqual([{ front: 'Term', back: 'Definition', category: undefined }])
  })

  it('detects tsv by extension', () => {
    const rows = parseFlashcardImport('A\tB', 'deck.txt')
    expect(rows).toEqual([{ front: 'A', back: 'B', category: undefined }])
  })

  it('parses csv', () => {
    const rows = parseFlashcardCsv('front,back\nQ,A')
    expect(rows).toEqual([{ front: 'Q', back: 'A', category: undefined }])
  })
})
