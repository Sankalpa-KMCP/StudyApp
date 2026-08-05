declare const __APP_VERSION__: string

export function resolveAppVersion(injectedVersion?: string): string {
  if (typeof injectedVersion === 'string' && injectedVersion.trim().length > 0) {
    return injectedVersion.trim()
  }
  throw new Error('Application version is missing or invalid from compile-time definition (__APP_VERSION__).')
}

export const APP_VERSION: string = resolveAppVersion(
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined
)

export function getAppVersion(): string {
  return APP_VERSION
}

