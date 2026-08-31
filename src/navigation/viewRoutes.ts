export type View =
  | 'Home'
  | 'Tasks'
  | 'Notes'
  | 'Subjects'
  | 'Calendar'
  | 'Progress'
  | 'Goals'
  | 'Settings'

const SEGMENT_BY_VIEW: Record<View, string> = {
  Home: '',
  Tasks: 'tasks',
  Notes: 'notes',
  Subjects: 'subjects',
  Calendar: 'calendar',
  Progress: 'progress',
  Goals: 'goals',
  Settings: 'settings',
}

const VIEW_BY_SEGMENT: Record<string, View> = {
  '': 'Home',
  tasks: 'Tasks',
  notes: 'Notes',
  subjects: 'Subjects',
  calendar: 'Calendar',
  progress: 'Progress',
  goals: 'Goals',
  settings: 'Settings',
}

/** Normalize Vite `BASE_URL` so it always ends with `/` (except the root is exactly `/`). */
export function normalizeAppBase(baseUrl: string = import.meta.env.BASE_URL): string {
  if (!baseUrl || baseUrl === '/') return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

/** Compare pathnames ignoring a single trailing slash (except root `/`). */
export function pathnamesMatch(left: string, right: string): boolean {
  return stripTrailingSlash(left) === stripTrailingSlash(right)
}

/**
 * Absolute pathname for a workspace view under the Vite base.
 * Home → `/` or `/StudyApp/`; Tasks → `/tasks` or `/StudyApp/tasks`.
 */
export function pathForView(view: View, baseUrl: string = import.meta.env.BASE_URL): string {
  const base = normalizeAppBase(baseUrl)
  const segment = SEGMENT_BY_VIEW[view]
  if (!segment) return base
  return `${base}${segment}`
}

/**
 * Map a browser pathname to a view, or `null` when the path is outside the app
 * base or is not one of the nine workspace routes.
 */
export function viewFromPathname(pathname: string, baseUrl: string = import.meta.env.BASE_URL): View | null {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const base = normalizeAppBase(baseUrl)
  let remainder: string

  if (base === '/') {
    remainder = decoded
  } else {
    const baseWithoutTrailingSlash = base.slice(0, -1)
    if (decoded === baseWithoutTrailingSlash || decoded === base) {
      remainder = '/'
    } else if (decoded.startsWith(base)) {
      remainder = `/${decoded.slice(base.length)}`
    } else if (decoded.startsWith(`${baseWithoutTrailingSlash}/`)) {
      remainder = `/${decoded.slice(baseWithoutTrailingSlash.length + 1)}`
    } else {
      return null
    }
  }

  const segment = remainder.replace(/^\/+|\/+$/g, '')
  if (segment.includes('/')) return null
  return VIEW_BY_SEGMENT[segment] ?? null
}

export type ResolvedViewRoute = {
  view: View
  canonicalPath: string
  /** True when the current pathname should be `replaceState`d to `canonicalPath`. */
  needsReplace: boolean
}

/**
 * Resolve the workspace view for a pathname. Unknown paths fall back to Home
 * and request a history replace (no extra entry).
 */
export function resolveViewFromPathname(
  pathname: string,
  baseUrl: string = import.meta.env.BASE_URL,
): ResolvedViewRoute {
  const matched = viewFromPathname(pathname, baseUrl)
  const view = matched ?? 'Home'
  const canonicalPath = pathForView(view, baseUrl)
  const needsReplace = matched === null || !pathnamesMatch(pathname, canonicalPath)
  return { view, canonicalPath, needsReplace }
}

export function formatDocumentTitle(view: View): string {
  if (view === 'Home') return 'Study Dashboard'
  return `${view} — Study Dashboard`
}
