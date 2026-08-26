import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SUBJECT_COLOR,
  InvalidSubjectColorError,
  isInvalidSubjectColorError,
  isValidSubjectColor,
  resolveSubjectColor,
} from './subjectColor'

describe('subjectColor', () => {
  describe('isValidSubjectColor', () => {
    it('accepts canonical 6-digit hex colors (lowercase and uppercase)', () => {
      expect(isValidSubjectColor('#111827')).toBe(true)
      expect(isValidSubjectColor('#2563eb')).toBe(true)
      expect(isValidSubjectColor('#0f766e')).toBe(true)
      expect(isValidSubjectColor('#FFFFFF')).toBe(true)
      expect(isValidSubjectColor('#abcdef')).toBe(true)
      expect(isValidSubjectColor('#ABCDEF')).toBe(true)
      expect(isValidSubjectColor('#123456')).toBe(true)
    })

    it('rejects CSS url(...) and network-beacon attempts', () => {
      expect(isValidSubjectColor("url('https://example.invalid/beacon.png')")).toBe(false)
      expect(isValidSubjectColor('url(http://127.0.0.1:9999/track)')).toBe(false)
      expect(isValidSubjectColor('#2563eb; background-image:url(http://evil.com)')).toBe(false)
    })

    it('rejects short hex, named colors, rgb/hsl functions, and malformed strings', () => {
      expect(isValidSubjectColor('#fff')).toBe(false)
      expect(isValidSubjectColor('#FFF')).toBe(false)
      expect(isValidSubjectColor('#123')).toBe(false)
      expect(isValidSubjectColor('red')).toBe(false)
      expect(isValidSubjectColor('blue')).toBe(false)
      expect(isValidSubjectColor('transparent')).toBe(false)
      expect(isValidSubjectColor('rgb(255, 0, 0)')).toBe(false)
      expect(isValidSubjectColor('hsl(120, 100%, 50%)')).toBe(false)
      expect(isValidSubjectColor('#12GG56')).toBe(false)
      expect(isValidSubjectColor('#1234567')).toBe(false)
      expect(isValidSubjectColor('#12345')).toBe(false)
      expect(isValidSubjectColor('123456')).toBe(false)
      expect(isValidSubjectColor(' #111827 ')).toBe(false)
      expect(isValidSubjectColor('')).toBe(false)
    })

    it('rejects non-string values safely', () => {
      expect(isValidSubjectColor(null)).toBe(false)
      expect(isValidSubjectColor(undefined)).toBe(false)
      expect(isValidSubjectColor(123456)).toBe(false)
      expect(isValidSubjectColor({})).toBe(false)
      expect(isValidSubjectColor([])).toBe(false)
    })
  })

  describe('resolveSubjectColor', () => {
    it('returns the valid color when stored color is valid', () => {
      expect(resolveSubjectColor('#2563eb')).toBe('#2563eb')
      expect(resolveSubjectColor('#047857')).toBe('#047857')
    })

    it('returns the default fallback when stored color is invalid or crafted', () => {
      expect(resolveSubjectColor("url('https://tracker.invalid/x')")).toBe(DEFAULT_SUBJECT_COLOR)
      expect(resolveSubjectColor('red')).toBe(DEFAULT_SUBJECT_COLOR)
      expect(resolveSubjectColor('#fff')).toBe(DEFAULT_SUBJECT_COLOR)
      expect(resolveSubjectColor(null)).toBe(DEFAULT_SUBJECT_COLOR)
      expect(resolveSubjectColor(undefined)).toBe(DEFAULT_SUBJECT_COLOR)
      expect(resolveSubjectColor('')).toBe(DEFAULT_SUBJECT_COLOR)
    })

    it('respects a custom fallback if provided', () => {
      expect(resolveSubjectColor('invalid', '#2563eb')).toBe('#2563eb')
    })
  })

  describe('InvalidSubjectColorError', () => {
    it('constructs an error with code and message', () => {
      const err = new InvalidSubjectColorError('bad-color')
      expect(err.name).toBe('InvalidSubjectColorError')
      expect(err.code).toBe('invalid_subject_color')
      expect(err.color).toBe('bad-color')
      expect(err.message).toContain('Invalid subject color')
      expect(isInvalidSubjectColorError(err)).toBe(true)
    })

    it('correctly identifies errors in type guard', () => {
      const custom = new Error('custom')
      Object.assign(custom, { code: 'invalid_subject_color' })

      expect(isInvalidSubjectColorError(new InvalidSubjectColorError('bad'))).toBe(true)
      expect(isInvalidSubjectColorError(custom)).toBe(true)
      expect(isInvalidSubjectColorError(new Error('other'))).toBe(false)
      expect(isInvalidSubjectColorError(null)).toBe(false)
      expect(isInvalidSubjectColorError({ code: 'invalid_subject_color' })).toBe(false)
    })
  })
})
