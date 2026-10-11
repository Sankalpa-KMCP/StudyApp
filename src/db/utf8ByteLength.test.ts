import { describe, expect, it } from 'vitest'
import { utf8ByteLength } from './utf8ByteLength'
import { assertStrictBackupability, serializeCanonicalBackup } from './backupabilityGuard'
import { STUDY_EXPORT_RECORD_LIMITS } from './studyExportLimits'
import type { StudyData } from './types'

describe('bounded UTF-8 byte measurement', () => {
  it.each(['', 'ASCII', '日本語 € é', '🚀📚', '\ud800', '\udc00', 'quotes"\\\n\t'])('matches platform encoding for %j', text => {
    expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).byteLength)
  })
  it.each([32_767, 32_768, 32_769, 65_535, 65_536])('preserves surrogate pairs and lone surrogates at offset %i', offset => {
    for (const suffix of ['🚀', '\ud800X', '\udc00', '日本語']) {
      const text = 'x'.repeat(offset) + suffix + '€'.repeat(40_000)
      expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).byteLength)
    }
  })
  it('matches a deterministic mixed UTF-16 corpus, including invalid surrogates', () => {
    let seed = 12345
    const units = Array.from({ length: 200_000 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return String.fromCharCode(seed & 0xffff)
    })
    const text = units.join('')
    expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).byteLength)
  })
  it('preserves canonical formatting, normalization, and exact inclusive byte boundaries', () => {
    const stamp = '2026-08-29T12:00:00.000Z'
    const data: StudyData = { tasks: [], subjects: [], notes: [{ id: 'n', title: '"title"', body: '🚀\n\\日本語'.repeat(10_000), tags: [], subjectId: '', createdAt: stamp, updatedAt: stamp }], events: [], studySessions: [], goals: [], settings: [{ key: 'databaseGeneration', value: 1 }] }
    const { payload, serialized, byteLength } = serializeCanonicalBackup(data, { exportedAt: stamp })
    expect(serialized).toBe(JSON.stringify(payload, null, 2))
    expect(payload.settings).toEqual([])
    expect(byteLength).toBe(new TextEncoder().encode(serialized).byteLength)
    expect(() => assertStrictBackupability(data, { maxBytes: byteLength, recordLimits: STUDY_EXPORT_RECORD_LIMITS })).not.toThrow()
    expect(() => assertStrictBackupability(data, { maxBytes: byteLength - 1, recordLimits: STUDY_EXPORT_RECORD_LIMITS })).toThrow(/64 MiB/)
  })
})
