import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  computeScriptHashes,
  extractInlineScriptContents,
  injectProductionCsp,
  CSP_UNSUPPORTED_IN_META_DIRECTIVES,
} from './csp'

const ROOT_DIR = resolve(process.cwd())
const INDEX_HTML_PATH = resolve(ROOT_DIR, 'index.html')
const PUBLIC_404_PATH = resolve(ROOT_DIR, 'public/404.html')
const DIST_INDEX_PATH = resolve(ROOT_DIR, 'dist/index.html')
const DIST_404_PATH = resolve(ROOT_DIR, 'dist/404.html')

describe('Content Security Policy (CSP)', () => {
  describe('buildContentSecurityPolicy', () => {
    it('generates the canonical restrictive policy with required production directives', () => {
      const policy = buildContentSecurityPolicy()

      expect(policy).toContain("default-src 'self'")
      expect(policy).toContain("script-src 'self'")
      expect(policy).toContain("style-src 'self' 'unsafe-inline'")
      expect(policy).toContain("img-src 'self' data:")
      expect(policy).toContain("font-src 'self'")
      expect(policy).toContain("connect-src 'self'")
      expect(policy).toContain("object-src 'none'")
      expect(policy).toContain("base-uri 'self'")
      expect(policy).toContain("form-action 'self'")
    })

    it('incorporates authorized inline script hashes into script-src without unsafe-inline or unsafe-eval', () => {
      const hash1 = "'sha256-abc1234567890='"
      const hash2 = "'sha256-def0987654321='"
      const policy = buildContentSecurityPolicy({ inlineScriptHashes: [hash1, hash2] })

      expect(policy).toContain(`script-src 'self' ${hash1} ${hash2}`)
      expect(policy).not.toContain("script-src 'unsafe-inline'")
      expect(policy).not.toContain('unsafe-eval')
    })

    it('does not contain broad wildcards or arbitrary external schemes', () => {
      const policy = buildContentSecurityPolicy()

      expect(policy).not.toContain('*')
      expect(policy).not.toContain('http:')
      expect(policy).not.toContain('https:')
      expect(policy).not.toContain('ws:')
      expect(policy).not.toContain('wss:')
    })

    it('does not include directives unsupported by HTML meta tags', () => {
      const policy = buildContentSecurityPolicy()

      for (const unsupported of CSP_UNSUPPORTED_IN_META_DIRECTIVES) {
        expect(policy).not.toContain(unsupported)
      }
    })
  })

  describe('computeScriptHashes', () => {
    it('produces valid sha256 hashes for LF and CRLF line endings', () => {
      const multiline = 'function test() {\n  return 42;\n}'
      const hashes = computeScriptHashes(multiline)

      expect(hashes.length).toBeGreaterThanOrEqual(1)
      for (const hash of hashes) {
        expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/)
      }
    })
  })

  describe('extractInlineScriptContents', () => {
    it('extracts inline script bodies and ignores external scripts with src', () => {
      const sampleHtml = `
        <!doctype html>
        <html>
          <head>
            <script type="text/javascript">var a = 1;</script>
            <script type="module" src="/assets/index.js"></script>
            <script>console.log("hello");</script>
          </head>
        </html>
      `
      const scripts = extractInlineScriptContents(sampleHtml)
      expect(scripts).toEqual(['var a = 1;', 'console.log("hello");'])
    })
  })

  describe('injectProductionCsp', () => {
    it('injects Content-Security-Policy meta tag into HTML head', () => {
      const sampleHtml = `<!doctype html><html><head><meta charset="UTF-8" /><script>var x = 10;</script></head><body></body></html>`
      const transformed = injectProductionCsp(sampleHtml)

      expect(transformed).toContain('<meta http-equiv="Content-Security-Policy" content="default-src')
      expect(transformed).toMatch(/script-src 'self' 'sha256-[^']+'/)
    })
  })

  describe('Repository HTML and build artifacts', () => {
    it('public/404.html contains valid production CSP matching its inline script', () => {
      const html404 = readFileSync(PUBLIC_404_PATH, 'utf8')
      const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(html404)

      expect(match, 'Missing CSP meta tag in public/404.html').not.toBeNull()
      const csp = match![1]
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("connect-src 'self'")
      expect(csp).toContain("object-src 'none'")

      const scripts = extractInlineScriptContents(html404)
      expect(scripts.length).toBe(1)
      const hashes = computeScriptHashes(scripts[0])
      for (const hash of hashes) {
        expect(csp).toContain(hash)
      }
    })

    it('injectProductionCsp correctly calculates hashes for index.html inline script', () => {
      const indexHtml = readFileSync(INDEX_HTML_PATH, 'utf8')
      const transformed = injectProductionCsp(indexHtml)
      const scripts = extractInlineScriptContents(indexHtml)

      expect(scripts.length).toBe(1)
      const hashes = computeScriptHashes(scripts[0])
      for (const hash of hashes) {
        expect(transformed).toContain(hash)
      }
    })

    it('dist/index.html contains valid production CSP if built', () => {
      if (!existsSync(DIST_INDEX_PATH)) return
      const distHtml = readFileSync(DIST_INDEX_PATH, 'utf8')
      const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(distHtml)

      expect(match, 'Missing CSP meta tag in dist/index.html').not.toBeNull()
      const csp = match![1]
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).not.toContain("script-src 'unsafe-inline'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(csp).toContain("img-src 'self' data:")
      expect(csp).toContain("font-src 'self'")
      expect(csp).toContain("connect-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(csp).toContain("form-action 'self'")
    })

    it('dist/404.html contains valid production CSP if built', () => {
      if (!existsSync(DIST_404_PATH)) return
      const dist404 = readFileSync(DIST_404_PATH, 'utf8')
      const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(dist404)

      expect(match, 'Missing CSP meta tag in dist/404.html').not.toBeNull()
      const csp = match![1]
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("connect-src 'self'")
    })
  })
})
