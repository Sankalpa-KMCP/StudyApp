import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_VERSION, getAppVersion, resolveAppVersion } from './appVersion'

describe('appVersion', () => {
  it('returns the exact version declared in package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))
    expect(APP_VERSION).toBe(pkg.version)
    expect(getAppVersion()).toBe(pkg.version)
  })

  it('contains no hard-coded current application-version fallback in source', () => {
    const appVersionSource = readFileSync(resolve(process.cwd(), 'src/appVersion.ts'), 'utf-8')
    expect(appVersionSource).not.toContain('1.4.0')
    expect(appVersionSource).not.toContain('0.0.0')
    expect(appVersionSource).not.toContain('unknown')
  })

  it('fails explicitly when the injected version is missing or invalid', () => {
    expect(() => resolveAppVersion(undefined)).toThrow(
      'Application version is missing or invalid from compile-time definition (__APP_VERSION__).'
    )
    expect(() => resolveAppVersion('')).toThrow(
      'Application version is missing or invalid from compile-time definition (__APP_VERSION__).'
    )
    expect(() => resolveAppVersion('   ')).toThrow(
      'Application version is missing or invalid from compile-time definition (__APP_VERSION__).'
    )
  })

  it('trims valid injected version string', () => {
    expect(resolveAppVersion(' 2.0.0 ')).toBe('2.0.0')
  })
})

