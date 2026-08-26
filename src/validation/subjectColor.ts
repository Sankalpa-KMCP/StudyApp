/**
 * Canonical subject color contract and safe rendering resolvers.
 *
 * Persisted subject colors must be strict 6-digit hex strings (#RRGGBB).
 * Any non-matching value (malformed hex, CSS functions like url(), named colors, etc.)
 * is rejected at validation boundaries and falls back safely during UI rendering.
 */

export const DEFAULT_SUBJECT_COLOR = '#111827'

const SUBJECT_COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/

/**
 * Validates that `value` is a canonical 6-digit hex color string (#RRGGBB).
 */
export function isValidSubjectColor(value: unknown): value is string {
  return typeof value === 'string' && SUBJECT_COLOR_HEX_REGEX.test(value)
}

/**
 * Resolves a subject color for UI rendering, falling back to a safe known palette color
 * if the stored value is missing, invalid, or malformed.
 */
export function resolveSubjectColor(color: unknown, fallback: string = DEFAULT_SUBJECT_COLOR): string {
  return isValidSubjectColor(color) ? color : fallback
}

/**
 * Distinguishable domain validation error thrown when an invalid subject color is supplied to domain services.
 */
export class InvalidSubjectColorError extends Error {
  readonly code = 'invalid_subject_color' as const
  readonly color: unknown

  constructor(color: unknown) {
    super(
      `Invalid subject color: expected 6-digit hex string (#RRGGBB), received ${
        typeof color === 'string' ? JSON.stringify(color) : String(color)
      }.`
    )
    this.name = 'InvalidSubjectColorError'
    this.color = color
  }
}

/**
 * Type guard for InvalidSubjectColorError.
 */
export function isInvalidSubjectColorError(error: unknown): error is InvalidSubjectColorError {
  return (
    error instanceof InvalidSubjectColorError ||
    (error instanceof Error && (error as { code?: string }).code === 'invalid_subject_color')
  )
}
