const heroDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

/** Formats the Home hero eyebrow from a local calendar Date. */
export function formatHeroDate(date: Date) {
  return heroDateFormatter.format(date)
}

/**
 * Greeting from the local hour of `date`:
 * morning before 12:00, afternoon 12:00–17:59, evening from 18:00.
 */
export function getTimeOfDayGreeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
