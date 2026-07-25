import { describe, expect, it } from 'vitest'
import {
  normalizeAppBase,
  pathForView,
  pathnamesMatch,
  resolveViewFromPathname,
  viewFromPathname,
  type View,
} from './viewRoutes'

const ALL_VIEWS: View[] = [
  'Home',
  'Tasks',
  'Notes',
  'Subjects',
  'Calendar',
  'Flashcards',
  'Progress',
  'Goals',
  'Settings',
]

describe('viewRoutes', () => {
  describe('normalizeAppBase', () => {
    it('normalizes empty and root bases to /', () => {
      expect(normalizeAppBase('')).toBe('/')
      expect(normalizeAppBase('/')).toBe('/')
    })

    it('ensures a trailing slash for non-root bases', () => {
      expect(normalizeAppBase('/StudyApp')).toBe('/StudyApp/')
      expect(normalizeAppBase('/StudyApp/')).toBe('/StudyApp/')
    })
  })

  describe('pathForView with development base /', () => {
    it.each([
      ['Home', '/'],
      ['Tasks', '/tasks'],
      ['Notes', '/notes'],
      ['Subjects', '/subjects'],
      ['Calendar', '/calendar'],
      ['Flashcards', '/flashcards'],
      ['Progress', '/progress'],
      ['Goals', '/goals'],
      ['Settings', '/settings'],
    ] as const)('maps %s to %s', (view, path) => {
      expect(pathForView(view, '/')).toBe(path)
    })
  })

  describe('pathForView with production base /StudyApp/', () => {
    it.each([
      ['Home', '/StudyApp/'],
      ['Tasks', '/StudyApp/tasks'],
      ['Notes', '/StudyApp/notes'],
      ['Subjects', '/StudyApp/subjects'],
      ['Calendar', '/StudyApp/calendar'],
      ['Flashcards', '/StudyApp/flashcards'],
      ['Progress', '/StudyApp/progress'],
      ['Goals', '/StudyApp/goals'],
      ['Settings', '/StudyApp/settings'],
    ] as const)('maps %s to %s', (view, path) => {
      expect(pathForView(view, '/StudyApp/')).toBe(path)
    })
  })

  describe('viewFromPathname', () => {
    it('round-trips every view under / and /StudyApp/', () => {
      for (const view of ALL_VIEWS) {
        expect(viewFromPathname(pathForView(view, '/'), '/')).toBe(view)
        expect(viewFromPathname(pathForView(view, '/StudyApp/'), '/StudyApp/')).toBe(view)
      }
    })

    it('accepts /StudyApp without a trailing slash as Home', () => {
      expect(viewFromPathname('/StudyApp', '/StudyApp/')).toBe('Home')
    })

    it('accepts a trailing slash on non-Home routes', () => {
      expect(viewFromPathname('/tasks/', '/')).toBe('Tasks')
      expect(viewFromPathname('/StudyApp/notes/', '/StudyApp/')).toBe('Notes')
    })

    it('returns null for unknown or nested paths', () => {
      expect(viewFromPathname('/focus', '/')).toBeNull()
      expect(viewFromPathname('/materials', '/')).toBeNull()
      expect(viewFromPathname('/tasks/extra', '/')).toBeNull()
      expect(viewFromPathname('/other/tasks', '/StudyApp/')).toBeNull()
      expect(viewFromPathname('/StudyApp/unknown', '/StudyApp/')).toBeNull()
    })
  })

  describe('resolveViewFromPathname', () => {
    it('keeps exact known paths without replace', () => {
      expect(resolveViewFromPathname('/calendar', '/')).toEqual({
        view: 'Calendar',
        canonicalPath: '/calendar',
        needsReplace: false,
      })
      expect(resolveViewFromPathname('/StudyApp/goals', '/StudyApp/')).toEqual({
        view: 'Goals',
        canonicalPath: '/StudyApp/goals',
        needsReplace: false,
      })
    })

    it('canonicalizes unknown paths to Home with replace', () => {
      expect(resolveViewFromPathname('/nope', '/')).toEqual({
        view: 'Home',
        canonicalPath: '/',
        needsReplace: true,
      })
      expect(resolveViewFromPathname('/StudyApp/nope', '/StudyApp/')).toEqual({
        view: 'Home',
        canonicalPath: '/StudyApp/',
        needsReplace: true,
      })
    })

    it('treats trailing-slash variants of known routes as matched without replace', () => {
      expect(resolveViewFromPathname('/tasks/', '/')).toEqual({
        view: 'Tasks',
        canonicalPath: '/tasks',
        needsReplace: false,
      })
    })
  })

  describe('pathnamesMatch', () => {
    it('treats an optional trailing slash as equivalent', () => {
      expect(pathnamesMatch('/tasks', '/tasks/')).toBe(true)
      expect(pathnamesMatch('/StudyApp/', '/StudyApp')).toBe(true)
      expect(pathnamesMatch('/', '/')).toBe(true)
      expect(pathnamesMatch('/tasks', '/notes')).toBe(false)
    })
  })
})
