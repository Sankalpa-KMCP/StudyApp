export const NOTE_TAG_HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const MAX_NOTE_TAG_COLORS = 8

/**
 * Normalizes a JSON-parsed value into at most eight hex note-tag colors.
 * Returns null when the value is not an array or yields no valid colors.
 */
export function parseNoteTagColorsArray(parsed: unknown): string[] | null {
  if (!Array.isArray(parsed)) return null
  const colors = parsed.filter(
    (c): c is string => typeof c === 'string' && NOTE_TAG_HEX_COLOR.test(c),
  )
  return colors.length > 0 ? colors.slice(0, MAX_NOTE_TAG_COLORS) : null
}
