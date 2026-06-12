import type { StudyBackupPayload } from '../study/studyDashboard'

export interface EncryptedBackupEnvelope {
  version: 4
  encrypted: true
  kdf: 'PBKDF2'
  cipher: 'AES-GCM'
  salt: string
  iv: string
  ciphertext: string
  checksumSha256: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackupPayload(
  payload: StudyBackupPayload,
  passphrase: string,
  checksumSha256: string,
): Promise<EncryptedBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext)
  return {
    version: 4,
    encrypted: true,
    kdf: 'PBKDF2',
    cipher: 'AES-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    checksumSha256,
  }
}

export async function decryptBackupEnvelope(envelope: EncryptedBackupEnvelope, passphrase: string): Promise<StudyBackupPayload> {
  const salt = fromBase64(envelope.salt)
  const iv = fromBase64(envelope.iv)
  const key = await deriveKey(passphrase, salt)
  const ciphertext = fromBase64(envelope.ciphertext)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource)
  return JSON.parse(new TextDecoder().decode(decrypted)) as StudyBackupPayload
}

export function isEncryptedBackupEnvelope(parsed: unknown): parsed is EncryptedBackupEnvelope {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as EncryptedBackupEnvelope).version === 4 &&
    (parsed as EncryptedBackupEnvelope).encrypted === true &&
    typeof (parsed as EncryptedBackupEnvelope).ciphertext === 'string'
  )
}
