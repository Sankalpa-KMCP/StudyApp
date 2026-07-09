import type { ParsedStudyBackupPayload, StudyBackupPayload } from '../study/studyDashboard'

export async function computeBackupChecksum(payload: Omit<StudyBackupPayload, 'checksumSha256'>): Promise<string> {
  const canonical = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(canonical)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function canonicalizeForChecksum(payload: ParsedStudyBackupPayload): Omit<StudyBackupPayload, 'checksumSha256'> {
  const { checksumSha256: _checksum, rawVersion: _rawVersion, _legacyFlashcards, ...rest } = payload
  void _checksum
  void _rawVersion
  if (payload.version < 4 && _legacyFlashcards) {
    return { ...rest, flashcards: _legacyFlashcards } as Omit<StudyBackupPayload, 'checksumSha256'> & {
      flashcards: typeof _legacyFlashcards
    }
  }
  return rest
}

export async function verifyBackupChecksum(payload: ParsedStudyBackupPayload): Promise<boolean> {
  if (!payload.checksumSha256) return true
  const expected = await computeBackupChecksum(canonicalizeForChecksum(payload))
  return expected === payload.checksumSha256
}
