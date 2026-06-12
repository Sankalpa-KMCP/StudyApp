import en from './locales/en.json'

const catalogs: Record<string, Record<string, string>> = { en }

let currentLocale = 'en'
const listeners = new Set<() => void>()

export function setAppLocale(locale: string): void {
  const next = catalogs[locale] ? locale : 'en'
  if (next === currentLocale) return
  currentLocale = next
  for (const listener of listeners) listener()
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type TranslationKey = keyof typeof en

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = catalogs[currentLocale]?.[key] ?? catalogs.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

export function getAppLocale(): string {
  return currentLocale
}
