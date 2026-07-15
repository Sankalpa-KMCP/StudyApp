import type { TranslationKey } from './index'

export const SUPPORTED_LOCALES = [
  { code: 'en', labelKey: 'localeEnglish' },
] as const satisfies ReadonlyArray<{ code: string; labelKey: TranslationKey }>
