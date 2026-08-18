import type { View } from './viewRoutes'

/** Persistent primary destinations in the mobile bottom navigation. */
export const MOBILE_PRIMARY_VIEWS = ['Home', 'Tasks', 'Notes', 'Progress'] as const satisfies ReadonlyArray<View>

/** Destinations exposed under the mobile More control. */
export const MOBILE_MORE_VIEWS = [
  'Subjects',
  'Calendar',
  'Flashcards',
  'Goals',
  'Settings',
] as const satisfies ReadonlyArray<View>

export type MobilePrimaryView = (typeof MOBILE_PRIMARY_VIEWS)[number]
export type MobileMoreView = (typeof MOBILE_MORE_VIEWS)[number]

export function isMobileMoreView(view: View): view is MobileMoreView {
  return (MOBILE_MORE_VIEWS as ReadonlyArray<View>).includes(view)
}

/** Shared with CSS `@media (max-width: 760px)` mobile navigation presentation. */
export const MOBILE_NAV_MAX_WIDTH_QUERY = '(max-width: 760px)'
