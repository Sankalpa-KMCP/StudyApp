import type { StudyBackupPayload } from '../study/studyDashboard'

export async function computeBackupChecksum(payload: Omit<StudyBackupPayload, 'checksumSha256'>): Promise<string> {
  const canonical = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(canonical)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyBackupChecksum(payload: StudyBackupPayload): Promise<boolean> {
  if (!payload.checksumSha256) return true
  const { checksumSha256, ...rest } = payload
  const canonical = { ...rest } as Omit<StudyBackupPayload, 'checksumSha256'>
  delete (canonical as StudyBackupPayload & { rawVersion?: unknown }).rawVersion
  const expected = await computeBackupChecksum(canonical)
  return expected === checksumSha256
}
