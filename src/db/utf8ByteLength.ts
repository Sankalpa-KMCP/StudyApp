const CHUNK_CODE_UNITS = 32_768

/** Exact platform UTF-8 size with bounded temporary allocation for large JSON strings. */
export function utf8ByteLength(text: string): number {
  const encoder = new TextEncoder()
  if (text.length <= CHUNK_CODE_UNITS) return encoder.encode(text).byteLength

  // UTF-8 needs at most three bytes per UTF-16 code unit (four per surrogate pair).
  const buffer = new Uint8Array(CHUNK_CODE_UNITS * 3)
  let bytes = 0
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + CHUNK_CODE_UNITS, text.length)
    const last = text.charCodeAt(end - 1)
    // Keep pairs together; otherwise TextEncoder would replace each split surrogate.
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--
    bytes += encoder.encodeInto(text.slice(offset, end), buffer).written
    offset = end
  }
  return bytes
}
