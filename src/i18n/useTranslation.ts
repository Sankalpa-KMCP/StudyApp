import { useSyncExternalStore } from 'react'
import { getAppLocale, subscribeLocale, t, type TranslationKey } from './index'

export function useTranslation() {
  const locale = useSyncExternalStore(subscribeLocale, getAppLocale, () => 'en')
  return {
    locale,
    t: (key: TranslationKey, params?: Record<string, string | number>) => t(key, params),
  }
}
